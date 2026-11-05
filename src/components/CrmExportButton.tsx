import { useState } from 'react';
import { Download, LoaderCircle } from 'lucide-react';
import { downloadCrmTransfer } from '../lib/crmTransfer';
import { humanError } from '../lib/helpers';

export function CrmExportButton({kind,id,disabled=false}: {kind:'class'|'school';id:string;disabled?:boolean}) {
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  return <div><button type="button" className="button button-secondary" disabled={disabled || busy} onClick={async()=>{
    if(busy)return;
    setBusy(true);setMessage('');setError('');
    try { const counts=await downloadCrmTransfer({kind,id});setMessage(`ZIP готов: ${counts.classes} кл., ${counts.students} детей, ${counts.orders} заявок. В CRM: Настройки → Импорт / экспорт → ${kind==='school'?'Импорт проекта':'Импорт класса/группы'}.`); }
    catch(reason){setError(humanError(reason));}finally{setBusy(false);}
  }}>{busy?<LoaderCircle size={18} className="spin"/>:<Download size={18}/>} {busy?'Готовим ZIP…':kind==='school'?'Экспорт школы в CRM (ZIP)':'Экспорт класса в CRM (ZIP)'}</button>{message&&<p role="status" className="settings-hint">{message}</p>}{error&&<p role="alert">{error}</p>}</div>;
}
