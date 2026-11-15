import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {CrmCatalogPage} from './CrmCatalogPage';
vi.mock('../components/CatalogViewer',()=>({CatalogViewer:()=>null}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('shows the public snapshot and directs orders to a class link without requesting a roster',async()=>{
 const fetcher=vi.fn(async()=>({ok:true,json:async()=>({catalog:[{id:'old-id',name:'Пример фото',price:350,category:'Детские образы',gender:'unisex',type:'photo',preview_url:'',preview_video_url:''}]})}));vi.stubGlobal('fetch',fetcher);
 render(<CrmCatalogPage/>);expect(await screen.findByRole('button',{name:'Смотреть услугу: Пример фото'})).toBeTruthy();
 expect(screen.getByText(/откройте ссылку вашего класса/)).toBeTruthy();expect(screen.queryByRole('button',{name:/Добавить .* в заказ/})).toBeNull();
 expect(fetcher).toHaveBeenCalledWith('/catalog-snapshot/catalog.json',{cache:'no-cache'});
});
