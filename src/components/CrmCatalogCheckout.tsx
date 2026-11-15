import {useEffect,useRef,useState} from 'react';
import {Modal,Notice,Loader} from './ui';
import {PublicChildRegistration} from './PublicChildRegistration';
import {PublicPendingRequests} from './PublicPendingRequests';
import {getPublicClass,submitPublicOrder} from '../lib/publicRepository';
import {humanError} from '../lib/helpers';
import {isCustomPublicItem,publicOrderTotal} from '../lib/publicOrderPrice';
import type {PublicClassPayload,PublicOrderResult} from '../lib/types';
type Directory={schools:Array<{id:string;name:string;city:string;classes:Array<{id:string;name:string;token:string}>}>};
export function CrmCatalogCheckout({items,withoutLaminationIds,onClose}:{items:Array<{id:string;name:string;price:number}>;withoutLaminationIds:string[];onClose:()=>void}){
 const [directory,setDirectory]=useState<Directory>({schools:[]}),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [schoolId,setSchoolId]=useState(''),[token,setToken]=useState(''),[childId,setChildId]=useState(''),[data,setData]=useState<PublicClassPayload|null>(null),[classLoading,setClassLoading]=useState(false),[pending,setPending]=useState(false),[result,setResult]=useState<PublicOrderResult|null>(null);
 const [note,setNote]=useState('');const busy=useRef(false),requestKey=useRef(crypto.randomUUID()),tokenRef=useRef(token);tokenRef.current=token;
 const school=directory.schools.find(value=>value.id===schoolId);const child=data?.children.find(value=>value.id===childId);
 async function loadDirectory(){setLoading(true);setError('');try{const response=await fetch('/api/v1/public/directory',{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error('Не удалось загрузить школы CRM. Повторите загрузку.');const value=await response.json();setDirectory(value);}catch(reason){setError(humanError(reason));}finally{setLoading(false);}}
 useEffect(()=>{void loadDirectory();},[]);
 async function refreshClass(){const selected=token;setClassLoading(true);try{const value=await getPublicClass(selected);if(!value)throw new Error('Класс сейчас недоступен. Выберите другой класс или обратитесь к фотографу.');if(tokenRef.current===selected)setData(value);}finally{if(tokenRef.current===selected)setClassLoading(false);}}
 useEffect(()=>{setData(null);setChildId('');setError('');if(token)void refreshClass().catch(reason=>{if(tokenRef.current===token)setError(humanError(reason));});},[token]);
 const unavailable=items.filter(item=>data&&!data.catalog.some(entry=>entry.id===item.id));
 async function submit(){
  if(!token||!childId||!data||busy.current||classLoading||unavailable.length)return;
  busy.current=true;setPending(true);setError('');
  try{
   const previous=child?.orders?.[0],active=previous?.status!=='cancelled'?previous:undefined;
   const previousItems=(active?.items||[]).filter(item=>!isCustomPublicItem(item));
   const selectedIds=new Set(items.map(item=>item.id));
   const itemIds=[...new Set([...previousItems.flatMap(item=>item.id?[item.id]:[]),...selectedIds])];
   const without=[...new Set([...previousItems.flatMap(item=>!selectedIds.has(item.id||'')&&(item.withoutLamination||item.comment?.startsWith('Без ламинации'))&&item.id?[item.id]:[]),...withoutLaminationIds])];
   const preferences=Object.fromEntries(previousItems.filter(item=>item.id).map(item=>[item.id,{comment:item.parent_comment||item.parentComment||'',videoAddonRequested:Boolean(item.video_addon_requested||item.videoAddonRequested)}]));
   const order=await submitPublicOrder({token,childId,itemIds,withoutLaminationIds:without,requestKey:requestKey.current,note,itemPreferences:preferences,revision:previous?.revision??0});setResult(order);
  }catch(reason){setError(humanError(reason));}finally{busy.current=false;setPending(false);}
 }
 return <Modal title={result?'Заявка сохранена':'Оформить заявку'} onClose={()=>{if(!pending)onClose();}}>
  {result?<div className="form-stack"><p><strong>{result.child_name}</strong> · {result.class_name}</p><p>Заявка {result.order_number} принята. Услуги появятся в карточке ребёнка в CRM.</p><ul>{result.selected_items.map((item,index)=><li key={`${item.id}-${index}`}>{item.name}</li>)}</ul><p>Итого: <strong>{publicOrderTotal(result)}</strong></p><button type="button" className="button button-primary" onClick={onClose}>Готово</button></div>:<div className="form-stack">
   <p>Выберите школу, класс и ребёнка. Если ребёнка нет в списке, добавьте его ниже.</p>
   {loading&&<Loader label="Загружаем школы CRM…"/>}
   {error&&<Notice kind="error">{error}</Notice>}{error&&!directory.schools.length&&<button type="button" className="button button-secondary" onClick={()=>void loadDirectory()}>Повторить загрузку школ</button>}
   {!directory.schools.length&&!loading&&!error&&<><Notice kind="info">Школы ещё не опубликованы в CRM. Попросите фотографа добавить вашу школу.</Notice><button type="button" className="button button-secondary" onClick={()=>void loadDirectory()}>Обновить школы</button></>}
   {directory.schools.length>0&&<><label>Школа или детский сад<select value={schoolId} disabled={pending} onChange={event=>{setSchoolId(event.target.value);setToken('');setData(null);setChildId('');}}><option value="">Выберите школу</option>{directory.schools.map(value=><option key={value.id} value={value.id}>{value.name}{value.city?` · ${value.city}`:''}</option>)}</select></label>
    {school&&<label>Класс или группа<select value={token} disabled={pending} onChange={event=>setToken(event.target.value)}><option value="">Выберите класс</option>{school.classes.map(value=><option key={value.id} value={value.token}>{value.name}</option>)}</select></label>}
    {school&&!school.classes.length&&<Notice kind="info">Классы этой школы ещё не опубликованы.</Notice>}
    {classLoading&&<Loader label="Загружаем список детей…"/>}
    {data&&!classLoading&&<><PublicPendingRequests token={token} onRefresh={refreshClass}/><label>Ребёнок<select value={childId} disabled={pending} onChange={event=>setChildId(event.target.value)}><option value="">{data.children.length?'Выберите ребёнка':'Детей пока нет — добавьте первого'}</option>{data.children.map(value=><option key={value.id} value={value.id}>{value.public_name}</option>)}</select></label>
     <PublicChildRegistration key={token} token={token} children={data.children} onSaved={value=>{if(tokenRef.current!==token)return;setChildId(value.id);void refreshClass().catch(reason=>setError(humanError(reason)));}} onChoose={id=>setChildId(id)}/>
     {child?.orders?.some(order=>order.status!=='cancelled')&&<Notice kind="info">У ребёнка уже есть заявка. Выбранные сейчас услуги добавятся к ней, прежние услуги сохранятся.</Notice>}
     <label>Комментарий к заявке<textarea value={note} onChange={event=>setNote(event.target.value)} maxLength={1000} rows={2}/></label>
     <p>Выбрано: {items.map(item=>item.name).join(', ')}</p>
     {unavailable.length>0&&<Notice kind="error">В этом классе пока недоступны услуги: {unavailable.map(item=>item.name).join(', ')}. Попросите фотографа обновить каталог класса.</Notice>}
     <button type="button" className="button button-primary" disabled={pending||!childId||unavailable.length>0} onClick={()=>void submit()}>{pending?'Отправляем…':'Отправить заявку'}</button>
    </>}
   </>}
  </div>}
 </Modal>;
}
