import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {parseCrmCatalogZip} from './catalogZip';
describe('published CRM catalog update',()=>{
 it('contains complete previews, stable IDs and class photo for 350 rubles',async()=>{
  const bytes=readFileSync('public/catalog-updates/crm-20261108.zip');
  const items=await parseCrmCatalogZip(new File([bytes],'catalog.zip'));
  expect(items).toHaveLength(79);
  expect(new Set(items.map(item=>item.sourceId)).size).toBe(79);
  for(const item of items) expect(item.previewImage?.size).toBeGreaterThan(0);
  const group=items.find(item=>item.sourceId==='school-class-photo-a4');
  expect(group).toMatchObject({price:350,parentPreviewMode:'print',name:'Общее фото класса'});
  expect(group?.previewVideo).toBeUndefined();
  expect(items.find(item=>item.sourceId==='child-boy-hogwarts-harry')?.name).toBe('Хогвартс — Гарри Поттер');
  expect(items.find(item=>item.sourceId==='child-girl-magic-academy-hijab')?.name).toBe('Хогвартс — Гермиона');
  expect(items.find(item=>item.sourceId==='child-girl-ladybird-heroine')?.name).toBe('Леди Баг и Супер-Кот');
  expect(items.filter(item=>item.category==='Игровые фотомонтажи')).toHaveLength(4);
  expect(items.filter(item=>item.name.includes('Боец ММА')||item.name.includes('Боксёр'))).toHaveLength(4);
 });
});
