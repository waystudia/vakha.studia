import { describe, it, expect, vi } from 'vitest';
vi.mock('./repository', () => ({loadCatalog: vi.fn(), loadClass: vi.fn(), loadSchool: vi.fn()}));
import { studentRecord, orderRecord, crmParentCatalogUrl } from './crmTransfer';
import type { Child, ParentOrder } from './types';
describe('CRM order transfer', () => {
  const order = {id:'order-1', child_id:'crm-child', status:'new',selected_items:[{id:'crm-service',name:'Фото',price:350,quantity:2,comment:'Две копии'}],total_amount:700} as ParentOrder;
  it('preserves original student/service identities, quantities and comments', () => {
    const student=studentRecord({id:'local-child',crm_source_id:'crm-child',first_name:'Сумайя',last_name:'Вакаева'} as Child,'crm-class',[order]);
    expect(student.id).toBe('crm-child');
    // Matching uses the normalized original identity supplied by the exporter.
    const matched=studentRecord({id:'crm-child',crm_source_id:'crm-child'} as Child,'crm-class',[order]);
    expect(matched.selectedServices).toEqual([{serviceId:'crm-service',quantity:2,comment:'Две копии',name:'Фото',price:350}]);
    expect(orderRecord(order).items[0]).toMatchObject({id:'order_crm-child_crm-service',serviceId:'crm-service',quantity:2,comment:'Две копии'});
  });
  it('builds a public class link for CRM',()=>expect(crmParentCatalogUrl('class token','https://waystudia.github.io/vakha.studia')).toBe('https://waystudia.github.io/p/class%20token'));
});

import JSZip from 'jszip';
import { buildCrmTransfer } from './crmTransfer';
import { loadCatalog, loadClass, loadSchool } from './repository';
describe('complete CRM ZIP contract', () => {
  const school={id:'s',crm_source_id:'crm-school',name:'Школа'};
  const classes=[{id:'c1',crm_source_id:'crm-class-1',name:'1А',public_token:'token-c1'},{id:'c2',crm_source_id:'crm-class-2',name:'2Б',public_token:'token-c2'}];
  function prepare() {
    vi.mocked(loadSchool).mockResolvedValue({school,classes} as never);
    vi.mocked(loadCatalog).mockResolvedValue([{id:'local-service',source_id:'crm-service',name:'Фото',price:350}] as never);
    vi.mocked(loadClass).mockImplementation(async id => ({school,schoolClass:classes.find(c=>c.id===id),children:[{id:`child-${id}`,crm_source_id:`crm-child-${id}`,first_name:'Имя',last_name:'Фамилия'}],orders:[{id:`order-${id}`,child_id:`child-${id}`,status:'new',created_at:'2026-11-05',selected_items:[{id:'local-service',name:'Фото',price:350,quantity:2,comment:'Две копии'}],total_amount:700}]} as never));
  }
  it('includes a service snapshot when an existing order references a removed catalog entry', async () => {
    prepare();
    vi.mocked(loadCatalog).mockResolvedValue([]);
    const {zip}=await buildCrmTransfer({kind:'class',id:'c1'});
    const data=JSON.parse(await zip.file('data.json')!.async('string'));
    expect(data.services[0]).toMatchObject({id:'local-service',name:'Фото',price:350});
    expect(data.orders[0].items[0].serviceId).toBe(data.services[0].id);
  });
  it.each([['school','s','project',2],['class','c1','class',1]] as const)('exports %s with scoped relationships and original CRM IDs', async (kind,id,exportType,count) => {
    prepare();
    const result=await buildCrmTransfer({kind,id});
    const zip=await JSZip.loadAsync(await result.zip.generateAsync({type:'uint8array'}));
    const manifest=JSON.parse(await zip.file('manifest.json')!.async('string'));
    const data=JSON.parse(await zip.file('data.json')!.async('string'));
    expect(manifest.exportType).toBe(exportType);
    expect(data.classes).toHaveLength(count);
    expect(data.students).toHaveLength(count);
    expect(data.orders).toHaveLength(count);
    expect(data.projects[0].id).toBe('crm-school');
    expect(data.classes[0].projectId).toBe('crm-school');
    expect(data.classes[0]).toMatchObject({parentCatalogToken:'token-c1'});
    expect(data.classes[0].parentCatalogUrl).toContain('/p/token-c1');
    expect(data.students[0]).toMatchObject({id:'crm-child-c1',classId:'crm-class-1',selectedServices:[{serviceId:'crm-service',quantity:2,comment:'Две копии',price:350}]});
    expect(data.orders[0]).toMatchObject({id:'order_crm-child-c1',studentId:'crm-child-c1',totalAmount:700});
    expect(data.services[0].id).toBe('crm-service');
    const repeat=await buildCrmTransfer({kind,id});
    expect(JSON.parse(await repeat.zip.file('data.json')!.async('string')).orders).toEqual(data.orders);
  });
});
