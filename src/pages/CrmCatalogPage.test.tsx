import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {CrmCatalogPage} from './CrmCatalogPage';
vi.mock('../lib/repository',()=>{throw new Error('CRM catalog must not load Supabase repository');});
vi.mock('../components/CatalogViewer',()=>({CatalogViewer:()=>null,viewerItems:(items:unknown[])=>items}));
vi.mock('../components/ParentIntro',()=>({ParentIntro:()=> <div>Видеоинструкция</div>}));
const items=[{id:'old-id',name:'Пример фото',price:350,popular:true,category:'Детские образы',gender:'unisex',type:'photo',preview_url:'',preview_video_url:''}];
function mount(){vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({catalog:items})})));render(<MemoryRouter><CrmCatalogPage/></MemoryRouter>);}
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('reuses legacy category covers, sticky filters and popular cards with snapshot data',async()=>{
 mount();await screen.findByRole('heading',{name:'Популярное'});
 expect(screen.getByText('Видеоинструкция')).toBeTruthy();expect(screen.getByRole('navigation',{name:'Быстрый переход по категориям'})).toBeTruthy();
 expect(document.querySelector('.public-catalog-shell .catalog-sticky-filters')).toBeTruthy();expect(document.querySelector('.catalog-category-cards')).toBeTruthy();
 expect(fetch).toHaveBeenCalledWith('/api/v1/public/catalog',expect.objectContaining({credentials:'omit',cache:'no-store'}));
});
it('opens school and class selection instead of requiring a pasted link',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url)=>({ok:true,json:async()=>String(url).includes('/directory')?{schools:[]}:{catalog:items}})));
 render(<MemoryRouter><CrmCatalogPage/></MemoryRouter>);const buttons=await screen.findAllByRole('button',{name:'Добавить Пример фото в заказ'});fireEvent.click(buttons[0]);
 fireEvent.click(screen.getByRole('button',{name:'Оформить заявку'}));
 expect(await screen.findByRole('dialog',{name:'Оформить заявку'})).toBeTruthy();expect(await screen.findByText(/Выберите школу, класс и ребёнка/)).toBeTruthy();expect(screen.queryByLabelText('Ссылка класса')).toBeNull();
});
