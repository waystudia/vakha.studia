import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {CrmCatalogCheckout} from './CrmCatalogCheckout';
import {getPublicClass,submitPublicOrder} from '../lib/publicRepository';
vi.mock('./PublicPendingRequests',()=>({PublicPendingRequests:()=>null}));
vi.mock('../lib/publicRepository',()=>({isCrmPublicMode:true,getPublicClass:vi.fn(),submitPublicOrder:vi.fn(),addPublicChild:vi.fn(),previewPublicChild:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks();vi.unstubAllGlobals();});
it('chooses server school/class/child and preserves prior selections without a manual link',async()=>{
 const token='server-class-token-12345678901234567890';
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({schools:[{id:'school',name:'Школа CRM',city:'Город',classes:[{id:'class',name:'3А',token}]}]})})));
 vi.mocked(getPublicClass).mockResolvedValue({school:{name:'Школа CRM',city:'Город'},class:{id:'class',name:'3А',academic_year:'2026',photo_session_name:'Фото'},children:[{id:'child',public_name:'Тестов Адам',orders:[{revision:2,status:'new',items:[{id:'old-photo',name:'Прежнее фото',parent_comment:'С мячом',video_addon_requested:true}]}]}],catalog:[{id:'new-photo',name:'Новое фото',price:350},{id:'old-photo',name:'Прежнее фото',price:350}]} as never);
 vi.mocked(submitPublicOrder).mockResolvedValue({order_number:'VS-TEST',child_name:'Тестов Адам',class_name:'3А',total_amount:700,selected_items:[{id:'new-photo',name:'Новое фото'}]} as never);
 render(<MemoryRouter><CrmCatalogCheckout items={[{id:'new-photo',name:'Новое фото',price:350}]} withoutLaminationIds={['new-photo']} onClose={vi.fn()}/></MemoryRouter>);
 fireEvent.change(await screen.findByLabelText('Школа или детский сад'),{target:{value:'school'}});fireEvent.change(screen.getByLabelText('Класс или группа'),{target:{value:token}});
 fireEvent.change(await screen.findByLabelText('Ребёнок'),{target:{value:'child'}});fireEvent.change(screen.getByLabelText('Комментарий к заявке'),{target:{value:'Тестовый комментарий'}});
 fireEvent.click(screen.getByRole('button',{name:'Отправить заявку'}));
 await waitFor(()=>expect(submitPublicOrder).toHaveBeenCalledWith(expect.objectContaining({token,childId:'child',revision:2,itemIds:['old-photo','new-photo'],withoutLaminationIds:['new-photo'],note:'Тестовый комментарий',itemPreferences:{'old-photo':{comment:'С мячом',videoAddonRequested:true}}})));
 expect(await screen.findByRole('heading',{name:'Заявка сохранена'})).toBeTruthy();expect(screen.queryByLabelText('Ссылка класса')).toBeNull();
});
it('does not present an outage as an empty CRM roster',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:false,status:503})));
 render(<MemoryRouter><CrmCatalogCheckout items={[]} withoutLaminationIds={[]} onClose={vi.fn()}/></MemoryRouter>);
 expect(await screen.findByText(/Не удалось загрузить школы CRM/)).toBeTruthy();expect(screen.queryByText(/Школы ещё не опубликованы/)).toBeNull();expect(screen.getByRole('button',{name:'Повторить загрузку школ'})).toBeTruthy();
});
