import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
vi.mock('../lib/repository', () => ({
 getPublicCatalog: vi.fn(async () => ({company_name:'Khan Zama',whatsapp:{phone:'+7 999 000-00-00',company:'Khan Zama'},watermark:{text:'',image:'',opacity:1},catalog:[{id:'photo',name:'Фото',price:350,category:'Фото',gender:'unisex',type:'photo',preview_url:'/photo.jpg',preview_video_url:'',parent_preview_mode:'print'}]})),
 searchCatalogInstitutions: vi.fn(async () => []),
 submitCatalogIntake: vi.fn(async () => ({inquiry_id:'inquiry',school_id:'school',class_id:'class',child_id:'child',order_id:'order',order_number:'VS-TEST123',institution:'Школа №1',city:'Грозный',group_name:'3А'})),
}));
vi.mock('../lib/offlineCatalog', () => ({loadSavedCatalog: vi.fn(async () => null)}));
vi.mock('../components/OfflineCatalogControls', () => ({OfflineCatalogControls: () => null}));
vi.mock('../components/ParentIntro', () => ({ParentIntro: () => <div>Знакомство со студией</div>}));
vi.mock('../lib/parentIntroProgress', () => ({hasWatchedParentIntro: () => true}));
vi.mock('../components/CatalogViewer', async importOriginal => ({...await importOriginal<object>(),CatalogViewer: ({immersive,readOnly}: {immersive:boolean;readOnly:boolean}) => <div role="dialog" aria-label={immersive ? 'Показ с прозрачными кнопками' : 'Обычный просмотр'}>{readOnly ? 'Только просмотр' : 'Выбор заказа'}</div>}));
import { PublicCatalogPage } from './PublicCatalogPage';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('separate general catalog modes', () => {
 it('allows institutions to select services and fill a contact request', async () => {
  render(<MemoryRouter><PublicCatalogPage catalogToken="test" /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button',{name:'Смотреть услугу: Фото'}));
  expect(screen.getByRole('dialog',{name:'Обычный просмотр'}).textContent).toBe('Выбор заказа');
  expect(screen.queryByRole('button',{name:'Открыть слайд-шоу'})).toBeNull();
  expect(screen.getByRole('button',{name:/Добавить.*заказ/})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:/Добавить.*заказ/}));
  expect(screen.getByText(/Корзина · 1/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Оформить заявку'}));
  expect(screen.getByRole('dialog',{name:'Оформить заявку'})).toBeTruthy();
  expect(screen.queryByRole('link',{name:'В админку'})).toBeNull();
  const open = vi.spyOn(window, 'open').mockImplementation(() => null);
  fireEvent.change(screen.getByLabelText('Название учреждения'), {target:{value:'Школа №1'}});
  fireEvent.click(await screen.findByRole('button',{name:/Создать новое учреждение/}));
  fireEvent.change(screen.getByLabelText('Населённый пункт'), {target:{value:'Грозный'}});
  fireEvent.change(screen.getByLabelText('Название класса или группы'), {target:{value:'3А'}});
  fireEvent.change(screen.getByLabelText('Фамилия'), {target:{value:'Иванов'}});
  fireEvent.change(screen.getByLabelText('Имя'), {target:{value:'Иван'}});
  fireEvent.change(screen.getByLabelText('Телефон родителя'), {target:{value:'+7 999 111-22-33'}});
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.submit(screen.getByRole('button',{name:'Отправить заявку'}).closest('form')!);
  await waitFor(() => expect(open).toHaveBeenCalledWith(expect.stringContaining('https://wa.me/79990000000'), '_blank', 'noopener,noreferrer'));
 });
 it('provides a slideshow entry for the staff presentation', async () => {
  render(<MemoryRouter><PublicCatalogPage catalogToken="test" presentation internal /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button',{name:'Открыть слайд-шоу'}));
  expect(screen.getByRole('dialog',{name:'Показ с прозрачными кнопками'})).toBeTruthy();
  expect(screen.getByRole('link',{name:'В админку'})).toBeTruthy();
 });
});
