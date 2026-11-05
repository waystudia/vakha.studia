import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { humanError } from '../lib/helpers';
import { Loader, Notice } from '../components/ui';
type Inquiry={id:string;institution:string;contact_name:string;phone:string;note:string;status:string;created_at:string;services:{name:string}[]};
export function InquiriesPage(){
 const [rows,setRows]=useState<Inquiry[]>([]); const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [pending,setPending]=useState('');
 useEffect(()=>{void supabase.from('catalog_inquiries').select('*').order('created_at',{ascending:false}).then(({data,error})=>{if(error)setError(humanError(error));else setRows(data||[]);setLoading(false);});},[]);
 return <div><h1>Новые школы и садики</h1><p>Обращения из общего каталога услуг</p>{error&&<Notice kind="error">{error}</Notice>}{loading?<Loader label="Загружаем заявки…"/>:rows.length===0?<p>Заявок пока нет. Отправьте учреждениям публичную ссылку из профиля.</p>:rows.map(row=><article className="form-card" key={row.id}><h2>{row.institution}</h2><p>{row.contact_name} · <a href={`tel:+${row.phone}`}>+{row.phone}</a></p><p>{row.services.map(item=>item.name).join(', ')}</p><p>{row.note}</p><small>{new Date(row.created_at).toLocaleString('ru-RU')}</small><label>Статус<select value={row.status} disabled={pending===row.id} onChange={async event=>{const status=event.target.value;setPending(row.id);setError('');const {error}=await supabase.from('catalog_inquiries').update({status}).eq('id',row.id).select('id').single();if(error)setError(humanError(error));else setRows(old=>old.map(item=>item.id===row.id?{...item,status}:item));setPending('');}}><option value="new">Новая</option><option value="contacted">Связались</option><option value="closed">Закрыта</option></select></label></article>)}</div>;
}
