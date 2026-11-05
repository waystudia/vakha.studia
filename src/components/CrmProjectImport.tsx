import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { currentUser } from '../lib/repository';
import { parseCrmProjectZip, type CrmProjectDraft } from '../lib/crmProjectImport';
import { humanError } from '../lib/helpers';
import { Modal, Notice } from './ui';
export function CrmProjectImport({onClose,onDone}:{onClose:()=>void;onDone:()=>void}) {
 const [file,setFile]=useState<File|null>(null),[draft,setDraft]=useState<CrmProjectDraft|null>(null),[error,setError]=useState(''),[archiveWarning,setArchiveWarning]=useState(''),[busy,setBusy]=useState(false),[progress,setProgress]=useState('');
 const [city,setCity]=useState(''),[year,setYear]=useState(()=>{const now=new Date(), y=now.getFullYear()-(now.getMonth()<8?1:0);return `${y}/${y+1}`;});
 async function read(next:File|undefined){setDraft(null);setFile(null);setError('');setArchiveWarning('');if(!next)return;setBusy(true);try{setDraft(await parseCrmProjectZip(next));setFile(next);}catch(e){setError(humanError(e));}finally{setBusy(false);}}
 async function apply(){if(!draft||!file)return;setBusy(true);setError('');try{
  const user=await currentUser();if(!user)throw Error('Войдите в аккаунт');
  setProgress('Сохраняем исходный ZIP…');
  const path=`${user.id}/${crypto.randomUUID()}.zip`;
  let archivePath='';
  const upload=await supabase.storage.from('crm-project-imports').upload(path,file,{contentType:'application/zip'});
  if(upload.error)setArchiveWarning(`Данные будут импортированы без копии ZIP: ${humanError(upload.error)}`);else archivePath=path;
  setProgress('Раскладываем школы, классы и детей…');
  const result=await supabase.rpc('import_crm_project',{payload:draft,default_city:city.trim(),default_year:year.trim(),archive_path:archivePath});
  if(result.error)throw result.error;
  onDone();
 }catch(e){setError(humanError(e));}finally{setBusy(false);setProgress('');}}
 return <Modal title="Импорт проекта из CRM Photo" onClose={()=>{if(!busy)onClose();}}><div className="form-stack">
  <p>В CRM откройте проект → «Экспорт в Vakha Studio». Можно также выбрать ZIP всех данных.</p>
  <label>ZIP проекта<input type="file" accept=".zip" disabled={busy} onChange={e=>void read(e.target.files?.[0])}/></label>
  {error&&<Notice kind="error">{error}</Notice>}
  {archiveWarning&&<Notice>{archiveWarning}</Notice>}
  {draft&&<><p><strong>{draft.projects.length}</strong> школ · <strong>{draft.classes.length}</strong> классов · <strong>{draft.students.length}</strong> детей</p>
   <ul>{draft.projects.map(p=><li key={p.id}>{p.name} — {draft.classes.filter(c=>c.projectId===p.id).length} классов</li>)}</ul>
   <label>Город, если не указан в CRM<input value={city} onChange={e=>setCity(e.target.value)} disabled={busy} placeholder="Например, Грозный"/></label>
   <label>Учебный год, если не указан в CRM<input value={year} onChange={e=>setYear(e.target.value)} disabled={busy}/></label>
   <p>Импортируются учителя и контакты, дети, выбранные услуги и заявки. Повторный импорт обновляет записи CRM. Существующие заявки родителей не перезаписываются.</p>
   <p>Исходный ZIP по возможности сохраняется в школе для скачивания. Если Storage не примет большой ZIP, школы, классы, учителя и дети всё равно импортируются.</p>
   {draft.mediaCount>0&&<Notice>В исходном ZIP {draft.mediaCount} записей с файлами. Они будут доступны через скачивание архива школы.</Notice>}
   <button className="button button-primary" disabled={busy||(!city.trim()&&draft.projects.some(p=>!p.city))||!year.trim()} onClick={()=>void apply()}>{busy?progress||'Проверяем…':'Подтвердить импорт'}</button>
  </>}
 </div></Modal>;
}
