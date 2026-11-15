import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import {PublicOrderPage} from './PublicOrderPage';
import {addPublicChild,previewPublicChild,attachPublicServiceVideo,getPublicClass,submitPublicOrder} from '../lib/publicRepository';
import {optimizeCatalogVideo} from '../lib/optimizeCatalogMedia';
vi.mock('../lib/parentIntroProgress',()=>({hasWatchedParentIntro:()=>true}));
vi.mock('../components/ParentIntro',()=>({ParentIntro:()=>null}));
vi.mock('../components/PublicPendingRequests',()=>({PublicPendingRequests:()=>null}));
vi.mock('../lib/optimizeCatalogMedia',()=>({optimizeCatalogVideo:vi.fn(async()=>new Blob(['optimized video'],{type:'video/mp4'}))}));
vi.mock('../lib/publicRepository',()=>({
 isCrmPublicMode:true,supportsPublicChildRegistration:true,
 PublicApiError:class extends Error {status=0},
 previewPublicChild:vi.fn(),addPublicChild:vi.fn(),cancelPublicOrder:vi.fn(),submitPublicCustomRequest:vi.fn(),
 submitPublicOrder:vi.fn(),attachPublicServiceVideo:vi.fn(),
 getPublicClass:vi.fn(async()=>({school:{name:'Тестовая школа'},class:{id:'class',name:'1А',photo_session_name:'Съёмка'},children:[{id:'child',public_name:'Тестов Адам',orders:[]}],catalog:[{id:'photo',name:'Фото',price:350,type:'photo',gender:'unisex',category:'Фото',preview_url:''}]})),
}));
beforeEach(()=>{vi.clearAllMocks();vi.spyOn(window,'scrollTo').mockImplementation(()=>{});Object.defineProperty(Element.prototype,'scrollIntoView',{value:vi.fn(),configurable:true});});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('resumes a failed video upload without resubmitting an accepted order or re-encoding the file',async()=>{
 const order={revision:1,duplicate:false,order_number:'VS-TEST',status:'new',selected_items:[{id:'photo',name:'Фото',type:'photo',price:850,video_addon_requested:true}],total_amount:850,child_name:'Тестов Адам',class_name:'1А',public_token:'view'} as const;
 vi.mocked(submitPublicOrder).mockResolvedValue(order as never);
 vi.mocked(attachPublicServiceVideo).mockRejectedValueOnce(new Error('Тестовый обрыв загрузки')).mockResolvedValueOnce({...order,revision:2} as never);
 render(<MemoryRouter initialEntries={['/p/test']}><Routes><Route path="/p/:token" element={<PublicOrderPage/>}/></Routes></MemoryRouter>);
 fireEvent.click(await screen.findByRole('button',{name:'Выбрать ребёнка'}));
 fireEvent.click(await screen.findByRole('button',{name:/Тестов Адам/}));
 fireEvent.click(screen.getByRole('button',{name:'Добавить Фото в заказ'}));
 fireEvent.click(screen.getByRole('checkbox',{name:/Оживление фото.*500/}));
 fireEvent.change(screen.getByLabelText(/Прикрепить видео для оживления/),{target:{files:[new File(['raw video'],'clip.mp4',{type:'video/mp4'})]}});
 fireEvent.click(screen.getByRole('button',{name:'Сохранить'}));
 fireEvent.click(screen.getByRole('button',{name:/Корзина/}));
 fireEvent.click(screen.getByRole('button',{name:'Оформить заявку'}));
 await screen.findByText(/Выбор услуг уже принят сервером.*Тестовый обрыв/);
 expect(submitPublicOrder).toHaveBeenCalledTimes(1);expect(attachPublicServiceVideo).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole('button',{name:'Оформить заявку'}));
 await waitFor(()=>expect(screen.getByRole('heading',{name:'Заявка сохранена'})).toBeTruthy());
 expect(submitPublicOrder).toHaveBeenCalledTimes(1);expect(attachPublicServiceVideo).toHaveBeenCalledTimes(2);expect(optimizeCatalogVideo).toHaveBeenCalledTimes(1);
 const [first,second]=vi.mocked(attachPublicServiceVideo).mock.calls;
 expect(first[0].video).toBe(second[0].video);expect(second[0].revision).toBe(1);
});

it('starts a cancelled order with an empty selection while retaining its server revision',async()=>{
 vi.mocked(getPublicClass).mockResolvedValueOnce({school:{name:'Тестовая школа'},class:{id:'class',name:'1А',photo_session_name:'Съёмка'},children:[{id:'child',public_name:'Тестов Адам',orders:[{revision:3,status:'cancelled',items:[{id:'photo',name:'Фото',price:350}]}]}],catalog:[{id:'photo',name:'Фото',price:350,type:'photo',gender:'unisex',category:'Фото',preview_url:''}]} as never);
 vi.mocked(submitPublicOrder).mockResolvedValue({revision:4,duplicate:false,order_number:'VS-NEW',status:'new',selected_items:[{id:'photo',name:'Фото',price:350,type:'photo'}],total_amount:350,child_name:'Тестов Адам',class_name:'1А',public_token:'view'});
 render(<MemoryRouter initialEntries={['/p/test']}><Routes><Route path="/p/:token" element={<PublicOrderPage/>}/></Routes></MemoryRouter>);
 fireEvent.click(await screen.findByRole('button',{name:'Выбрать ребёнка'}));
 const child=await screen.findByRole('button',{name:/Тестов Адам/});expect(child.textContent).toContain('Пока без заявки');fireEvent.click(child);
 fireEvent.click(screen.getByRole('button',{name:'Добавить Фото в заказ'}));fireEvent.click(screen.getByRole('button',{name:'Сохранить'}));
 fireEvent.click(screen.getByRole('button',{name:/Корзина/}));fireEvent.click(screen.getByRole('button',{name:'Оформить заявку'}));
 await waitFor(()=>expect(submitPublicOrder).toHaveBeenCalledWith(expect.objectContaining({revision:3,itemIds:['photo']})));
});

it('opens class links in the photo catalog and preserves the selection through child checkout and closing the picker',async()=>{
 vi.mocked(submitPublicOrder).mockResolvedValue({revision:1,duplicate:false,order_number:'VS-CATALOG',status:'new',selected_items:[{id:'photo',name:'Фото',price:350,type:'photo'}],total_amount:350,child_name:'Тестов Адам',class_name:'1А',public_token:'view'});
 render(<MemoryRouter initialEntries={['/p/test']}><Routes><Route path="/p/:token" element={<PublicOrderPage/>}/></Routes></MemoryRouter>);
 expect(await screen.findByRole('heading',{name:'Каталог фотографий'})).toBeTruthy();
 expect(screen.queryByRole('button',{name:/Тестов Адам/})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Добавить Фото в заказ'}));
 fireEvent.change(screen.getByLabelText(/Короткий комментарий/),{target:{value:'Наше пожелание'}});
 fireEvent.click(screen.getByRole('button',{name:'Сохранить'}));
 fireEvent.click(screen.getByRole('button',{name:/Корзина/}));
 fireEvent.click(screen.getByRole('button',{name:'Оформить заявку'}));
 expect(screen.getByRole('dialog',{name:'Для кого оформить заявку?'})).toBeTruthy();
 expect(submitPublicOrder).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Закрыть'}));
 expect(screen.getByRole('button',{name:'Убрать Фото из заказа'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:/Корзина/}));fireEvent.click(screen.getByRole('button',{name:'Оформить заявку'}));
 fireEvent.click(screen.getByRole('button',{name:/Тестов Адам/}));
 fireEvent.click(screen.getByRole('button',{name:'Оформить заявку'}));
 await waitFor(()=>expect(submitPublicOrder).toHaveBeenCalledWith(expect.objectContaining({childId:'child',itemIds:['photo'],itemPreferences:{photo:{comment:'Наше пожелание',videoAddonRequested:false}}})));
});

it('keeps chosen photos while adding a missing child at checkout',async()=>{
 const added={id:'new-child',public_name:'Новый Адам',orders:[]};
 vi.mocked(addPublicChild).mockResolvedValue({child:added} as never);
 vi.mocked(previewPublicChild).mockResolvedValue({matches:[]} as never);
 render(<MemoryRouter initialEntries={['/p/test']}><Routes><Route path="/p/:token" element={<PublicOrderPage/>}/></Routes></MemoryRouter>);
 fireEvent.click(await screen.findByRole('button',{name:'Добавить Фото в заказ'}));fireEvent.click(screen.getByRole('button',{name:'Сохранить'}));
 fireEvent.click(screen.getByRole('button',{name:/Корзина/}));fireEvent.click(screen.getByRole('button',{name:'Оформить заявку'}));
 fireEvent.click(screen.getByRole('button',{name:'+ Добавить ребёнка'}));
 fireEvent.change(screen.getByLabelText('Фамилия'),{target:{value:'Новый'}});fireEvent.change(screen.getByLabelText('Имя'),{target:{value:'Адам'}});
 fireEvent.click(screen.getByRole('button',{name:'Добавить в список'}));
 fireEvent.click(await screen.findByRole('button',{name:'Продолжить оформление'}));
 expect(screen.queryByRole('dialog',{name:'Для кого оформить заявку?'})).toBeNull();
 expect(screen.getByRole('heading',{name:'Новый Адам'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'Убрать Фото из заказа'})).toBeTruthy();
 expect(submitPublicOrder).not.toHaveBeenCalled();
});
