import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
vi.mock('../lib/repository', () => ({getPublicCatalog: vi.fn(async () => ({company_name:'Vakha Studio',watermark:{text:'',image:'',opacity:1},catalog:[{id:'photo',name:'Фото',price:350,category:'Фото',gender:'unisex',type:'photo',preview_url:'/photo.jpg',preview_video_url:'',parent_preview_mode:'print'}]})),submitCatalogInquiry:vi.fn()}));
vi.mock('../lib/offlineCatalog', () => ({loadSavedCatalog: vi.fn(async () => null)}));
vi.mock('../components/OfflineCatalogControls', () => ({OfflineCatalogControls: () => null}));
vi.mock('../components/CatalogViewer', async importOriginal => ({...await importOriginal<object>(),CatalogViewer: ({immersive,readOnly}: {immersive:boolean;readOnly:boolean}) => <div role="dialog" aria-label={immersive ? 'Показ с прозрачными кнопками' : 'Обычный просмотр'}>{readOnly ? 'Только просмотр' : 'Выбор заказа'}</div>}));
import { PublicCatalogPage } from './PublicCatalogPage';
afterEach(cleanup);
describe('separate general catalog modes', () => {
 it('allows institutions to select services and fill a contact request', async () => {
  render(<MemoryRouter><PublicCatalogPage catalogToken="test" /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button',{name:'Смотреть услугу: Фото'}));
  expect(screen.getByRole('dialog',{name:'Обычный просмотр'}).textContent).toBe('Выбор заказа');
  expect(screen.queryByRole('button',{name:'Открыть слайд-шоу'})).toBeNull();
  expect(screen.getByRole('button',{name:/Добавить.*заказ/})).toBeTruthy();
  expect(screen.getByLabelText('Телефон')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:/Добавить.*заказ/}));
  expect(screen.getByText('Выбрано: 1')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Оформить заявку'}));
  expect(screen.getByRole('dialog',{name:'Оформить заявку'})).toBeTruthy();
 });
 it('provides a slideshow entry for the staff presentation', async () => {
  render(<MemoryRouter><PublicCatalogPage catalogToken="test" presentation internal /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button',{name:'Открыть слайд-шоу'}));
  expect(screen.getByRole('dialog',{name:'Показ с прозрачными кнопками'})).toBeTruthy();
  expect(screen.getByRole('link',{name:'В админку'})).toBeTruthy();
 });
});
