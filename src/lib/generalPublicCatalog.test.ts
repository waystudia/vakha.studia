import {afterEach,expect,it,vi} from 'vitest';
import {loadGeneralPublicCatalog} from './generalPublicCatalog';
afterEach(()=>vi.unstubAllGlobals());
it('uses canonical public catalog even when all services have been archived',async()=>{const fetcher=vi.fn(async()=>({ok:true,status:200,json:async()=>({catalog:[]})}));vi.stubGlobal('fetch',fetcher);expect((await loadGeneralPublicCatalog()).catalog).toEqual([]);expect(fetcher).toHaveBeenCalledTimes(1);});
it('uses the old downloaded snapshot only when the public catalog endpoint is absent',async()=>{const fetcher=vi.fn().mockResolvedValueOnce({ok:false,status:404}).mockResolvedValueOnce({ok:true,json:async()=>({catalog:[{id:'old'}]})});vi.stubGlobal('fetch',fetcher);expect((await loadGeneralPublicCatalog()).catalog[0].id).toBe('old');expect(fetcher.mock.calls[1][0]).toBe('/catalog-snapshot/catalog.json');});
it('does not resurrect stale services after an actual CRM server failure',async()=>{const fetcher=vi.fn(async()=>({ok:false,status:503}));vi.stubGlobal('fetch',fetcher);await expect(loadGeneralPublicCatalog()).rejects.toThrow('временно недоступен');expect(fetcher).toHaveBeenCalledTimes(1);});
