import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {parseCrmCatalogZip} from './catalogZip';
describe('published CRM catalog update',()=>{
 it('contains complete previews, stable IDs and class photo for 350 rubles',async()=>{
  const bytes=readFileSync('public/catalog-updates/crm-20261104.zip');
  const items=await parseCrmCatalogZip(new File([bytes],'catalog.zip'));
  expect(items).toHaveLength(78);
  expect(new Set(items.map(item=>item.sourceId)).size).toBe(78);
  for(const item of items) expect(item.previewImage?.size).toBeGreaterThan(0);
  const group=items.find(item=>item.sourceId==='school-class-photo-a4');
  expect(group).toMatchObject({price:350,parentPreviewMode:'print',name:'Общее фото класса'});
  expect(group?.previewVideo).toBeUndefined();
 });
});
