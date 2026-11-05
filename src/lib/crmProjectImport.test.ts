import {describe,it,expect} from 'vitest';
import {validateCrmProject} from './crmProjectImport';
const base={projects:[{id:'p',name:'Школа'}],classes:[{id:'c',projectId:'p',name:'1А',teacher:{name:'Учитель',phone:'79990000000'}}],students:[{id:'s',classId:'c',firstName:'Али',lastName:'Алиев'}]};
describe('CRM project mapping',()=>{
 it('keeps 432 children and class links intact',()=>{
  const data={...base,classes:[...base.classes,{id:'c2',projectId:'p',name:'2А'}],students:Array.from({length:432},(_,i)=>({...base.students[0],id:`s${i}`,classId:i<177?'c':'c2'}))};
  const result=validateCrmProject(data);expect(result.students.filter(s=>s.classId==='c')).toHaveLength(177);expect(result.students.filter(s=>s.classId==='c2')).toHaveLength(255);expect(result.classes[0].teacher.phone).toBe('79990000000');
 });
 it('rejects orphan children and duplicate IDs before writes',()=>{
  expect(()=>validateCrmProject({...base,students:[{...base.students[0],classId:'missing'}]})).toThrow();
  expect(()=>validateCrmProject({...base,students:[...base.students,...base.students]})).toThrow();
 });
 it('rejects missing names without manufacturing children',()=>expect(()=>validateCrmProject({...base,students:[{id:'s',classId:'c'}]})).toThrow());
});
it('reads an actual CRM-format ZIP with manifest and data',async()=>{
 const {default:JSZip}=await import('jszip');const {parseCrmProjectZip}=await import('./crmProjectImport');
 const zip=new JSZip();zip.file('manifest.json',JSON.stringify({app:'Vakha Studio',schemaVersion:1,exportType:'project'}));zip.file('data.json',JSON.stringify(base));
 const data=await zip.generateAsync({type:'uint8array'});
 const draft=await parseCrmProjectZip(new File([new Uint8Array(data).buffer],'project.zip',{type:'application/zip'}));
 expect(draft.students[0].classId).toBe('c');expect(draft.classes[0].projectId).toBe('p');
});
