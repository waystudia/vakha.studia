import {afterEach,describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {CrmProjectImport} from './CrmProjectImport';
const mocks=vi.hoisted(()=>({rpc:vi.fn(),upload:vi.fn(),remove:vi.fn(),parse:vi.fn()}));
vi.mock('../lib/supabase',()=>({supabase:{rpc:mocks.rpc,storage:{from:()=>({upload:mocks.upload,remove:mocks.remove})}}}));
vi.mock('../lib/repository',()=>({currentUser:async()=>({id:'owner'})}));
vi.mock('../lib/crmProjectImport',()=>({parseCrmProjectZip:mocks.parse}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
describe('project import confirmation',()=>{
 it('previews before any write and uploads archive before atomic import',async()=>{
  const draft={projects:[{id:'p',name:'Школа'}],classes:[{id:'c',projectId:'p'}],students:[{id:'s'}],services:[],orders:[],mediaCount:0};
  mocks.parse.mockResolvedValue(draft);mocks.upload.mockResolvedValue({error:null});mocks.rpc.mockResolvedValue({error:null});
  const done=vi.fn();render(<CrmProjectImport onClose={()=>{}} onDone={done}/>);
  fireEvent.change(screen.getByLabelText('ZIP проекта'),{target:{files:[new File(['test'],'project.zip')]}});
  await screen.findByText('Подтвердить импорт');expect(mocks.upload).not.toHaveBeenCalled();expect(mocks.rpc).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Город, если не указан в CRM'),{target:{value:'Грозный'}});
  fireEvent.click(screen.getByText('Подтвердить импорт'));
  await waitFor(()=>expect(done).toHaveBeenCalledOnce());
  expect(mocks.rpc).toHaveBeenCalledWith('import_crm_project',expect.objectContaining({payload:draft,default_city:'Грозный'}));
  expect(mocks.upload.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0]);
 });
 it('shows database failure and does not claim success',async()=>{
  mocks.parse.mockResolvedValue({projects:[{id:'p',name:'Школа',city:'Грозный'}],classes:[],students:[],services:[],orders:[],mediaCount:0});
  mocks.upload.mockResolvedValue({error:null});mocks.rpc.mockResolvedValue({error:new Error('Конфликт класса')});mocks.remove.mockResolvedValue({error:null});
  const done=vi.fn();render(<CrmProjectImport onClose={()=>{}} onDone={done}/>);
  fireEvent.change(screen.getByLabelText('ZIP проекта'),{target:{files:[new File(['test'],'project.zip')]}});
  fireEvent.click(await screen.findByText('Подтвердить импорт'));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent','Конфликт класса');expect(done).not.toHaveBeenCalled();expect(mocks.remove).not.toHaveBeenCalled();
 });
 it('imports structured data when Storage rejects the optional ZIP copy',async()=>{
  const draft={projects:[{id:'p',name:'Школа',city:'Грозный'}],classes:[{id:'c',projectId:'p'}],students:[],services:[],orders:[],mediaCount:0};
  mocks.parse.mockResolvedValue(draft);mocks.upload.mockResolvedValue({error:{error:{message:'Object exceeded the maximum allowed size'}}});mocks.rpc.mockResolvedValue({error:null});
  const done=vi.fn();render(<CrmProjectImport onClose={()=>{}} onDone={done}/>);
  fireEvent.change(screen.getByLabelText('ZIP проекта'),{target:{files:[new File(['test'],'large.zip')]}});
  fireEvent.click(await screen.findByText('Подтвердить импорт'));
  await waitFor(()=>expect(done).toHaveBeenCalledOnce());
  expect(mocks.rpc).toHaveBeenCalledWith('import_crm_project',expect.objectContaining({archive_path:''}));
 });
});
