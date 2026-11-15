import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
beforeEach(()=>{vi.resetModules();vi.stubEnv('VITE_CRM_MODE','true');});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks();});
it('uses staff host-only session auth and never stores credentials in browser storage',async()=>{
 const save=vi.spyOn(Storage.prototype,'setItem');const fetcher=vi.fn(async()=>json({id:'staff',login:'owner',name:'Owner',role:'admin'}));vi.stubGlobal('fetch',fetcher);
 const {crmStudioCall}=await import('./crmStudioRepository');await crmStudioCall('signIn',['owner','example-password']);
 expect(fetcher).toHaveBeenCalledWith('/api/v1/login',expect.objectContaining({credentials:'same-origin',body:JSON.stringify({login:'owner',password:'example-password'})}));expect(save).not.toHaveBeenCalled();
});
it('does not turn a missing session into an endless auth-refresh loop',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>json({error:'Войдите'},401)));const changed=vi.fn();window.addEventListener('vakha-studio-auth',changed);
 const {crmStudioCall}=await import('./crmStudioRepository');expect(await crmStudioCall('currentUser',[])).toBeNull();expect(changed).not.toHaveBeenCalled();window.removeEventListener('vakha-studio-auth',changed);
});
it('passes canonical parent revision to a manual class creation, without unrelated revisions',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(json([{id:'project',revision:42},{id:'other-project',revision:80}])).mockResolvedValueOnce(json({id:'class',revision:43}));vi.stubGlobal('fetch',fetcher);
 const {crmStudioCall}=await import('./crmStudioRepository');await crmStudioCall('loadSchools',[]);await crmStudioCall('createClass',[{school_id:'project',name:'3А'}]);
 const body=JSON.parse(fetcher.mock.calls[1][1].body);expect(body.args).toEqual([{school_id:'project',name:'3А'}]);expect(body.revisions).toEqual({project:42});expect(body.requestKey).toBeTruthy();
});
it('reuses the same mutation key after a lost server response, with no automatic replay',async()=>{
 const fetcher=vi.fn().mockRejectedValueOnce(new Error('lost response')).mockResolvedValueOnce(json({id:'same-id',revision:3}));vi.stubGlobal('fetch',fetcher);
 const {crmStudioCall}=await import('./crmStudioRepository');await expect(crmStudioCall('createSchool',[{name:'Тест'}])).rejects.toThrow('Нет ответа');expect(fetcher).toHaveBeenCalledTimes(1);
 await crmStudioCall('createSchool',[{name:'Тест'}]);expect(JSON.parse(fetcher.mock.calls[0][1].body).requestKey).toBe(JSON.parse(fetcher.mock.calls[1][1].body).requestKey);
});
it('keeps stale-version edits paused instead of silently applying them with a newer revision',async()=>{
 const fetcher=vi.fn(async()=>json({error:'version_conflict'},409));vi.stubGlobal('fetch',fetcher);
 const {crmStudioCall}=await import('./crmStudioRepository');await expect(crmStudioCall('updateChild',['child',{first_name:'Иса'}])).rejects.toThrow('Данные изменились');expect(fetcher).toHaveBeenCalledTimes(1);
});
it('loads the repository facade in CRM mode without initializing Supabase',async()=>{
 vi.doMock('./supabase',()=>{throw new Error('Must not initialize legacy auth');});vi.stubGlobal('fetch',vi.fn(async()=>json([])));
 const {loadSchools}=await import('./repository');expect(await loadSchools()).toEqual([]);vi.doUnmock('./supabase');
});
