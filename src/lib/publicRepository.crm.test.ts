import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({get:vi.fn(), mutate:vi.fn(), preview:vi.fn()}));
vi.mock('./crmPublicClient', () => ({crmPublicClient:mock,PublicApiError: class extends Error {}}));
vi.mock('./supabase', () => {throw new Error('CRM mode must not load Supabase');});
beforeEach(() => {vi.stubEnv('VITE_CRM_MODE','true');vi.resetModules();vi.clearAllMocks();mock.mutate.mockResolvedValue({selected_items:[]});});
afterEach(() => vi.unstubAllEnvs());
it('loads only the capability class and uses CRM-supplied attachment URLs',async()=>{
 const api=await import('./publicRepository');
 mock.get.mockResolvedValue({school:{name:'Школа'},class:{id:'c'},children:[{id:'kid',public_name:'Иса',orders:[{items:[{reference_path:'private',preview_url:'/api/v1/public/signed/preview'}]}]}],catalog:[]});
 const payload=await api.getPublicClass('class/token');
 expect(mock.get).toHaveBeenCalledWith('classes/class%2Ftoken');
 expect(payload?.children[0].orders?.[0].items[0].preview_url).toBe('/api/v1/public/signed/preview');
 expect(api.supportsPublicChildRegistration).toBe(true);
});
it('routes preview and public creation to CRM with stable input names',async()=>{
 const api=await import('./publicRepository');
 await api.previewPublicChild({token:'t',firstName:'Иса',lastName:'Гараев'});
 await api.addPublicChild({token:'t',firstName:'Иса',lastName:'Гараев'});
 expect(mock.preview).toHaveBeenCalledWith('classes/t/children/preview',{firstName:'Иса',lastName:'Гараев'});
 expect(mock.mutate).toHaveBeenCalledWith('classes/t/children',{firstName:'Иса',lastName:'Гараев'});
});
it('sends comments and revisions; never sends browser totals or a guessed price',async()=>{
 const api=await import('./publicRepository');
 await api.submitPublicOrder({token:'t',childId:'c',itemIds:['s'],withoutLaminationIds:[],requestKey:'k',note:'',revision:4,itemPreferences:{s:{comment:'С мячом',videoAddonRequested:true}}});
 expect(mock.mutate).toHaveBeenCalledWith('classes/t',expect.objectContaining({revision:4,itemPreferences:{s:{comment:'С мячом',videoAddonRequested:true}}}));
 expect(mock.mutate.mock.calls[0][1]).not.toHaveProperty('total_amount');
 expect(mock.mutate.mock.calls[0][1]).not.toHaveProperty('token');
});
it('sends image and video multipart to CRM instead of an Edge Function',async()=>{
 const api=await import('./publicRepository'); const image=new File(['image'],'screen.webp',{type:'image/webp'});const video=new File(['video'],'clip.mp4',{type:'video/mp4'});
 await api.submitPublicCustomRequest({token:'t',childId:'c',message:'Идея',requestKey:'k',catalogItemId:'s',referenceFile:image,revision:3});
 await api.attachPublicServiceVideo({token:'t',childId:'c',itemId:'s',video,revision:4});
 const [imagePath,imageForm]=mock.mutate.mock.calls[0]; const [videoPath,videoForm]=mock.mutate.mock.calls[1];
 expect(imagePath).toBe('classes/t/children/c/custom-request'); expect(imageForm.get('reference').name).toBe('screen.webp'); expect(imageForm.get('revision')).toBe('3');
 expect(videoPath).toBe('classes/t/children/c/service-video'); expect(videoForm.get('video').name).toBe('clip.mp4'); expect(videoForm.get('revision')).toBe('4');
});
it('cancels using the version of the currently displayed order',async()=>{
 const api=await import('./publicRepository'); await api.cancelPublicOrder({token:'t',childId:'c',revision:8});
 expect(mock.mutate).toHaveBeenCalledWith('classes/t/children/c/order/cancel',{revision:8});
});
it('does not send CRM capability tokens to Supabase visit analytics',async()=>{
 const fetchMock=vi.fn();vi.stubGlobal('fetch',fetchMock);
 const {trackPublicVisit}=await import('./visitAnalytics');trackPublicVisit('private-token','class');
 expect(fetchMock).not.toHaveBeenCalled();vi.unstubAllGlobals();
});
it('does not alter signed CRM media URLs',async()=>{
 const {catalogMediaUrl}=await import('./mediaUrl');const signed='https://media.test/file?X-Amz-Signature=exact';
 expect(catalogMediaUrl(signed)).toBe(signed);
});
