import { describe, it, expect, vi } from 'vitest';
const mockReferenceDownload = vi.hoisted(() => vi.fn());
vi.mock('./repository', () => ({loadCatalog: vi.fn(), loadClass: vi.fn(), loadSchool: vi.fn()}));
vi.mock('./supabase', () => ({supabase:{storage:{from:()=>({download:mockReferenceDownload})}}}));
import { studentRecord, orderRecord, crmParentCatalogUrl } from './crmTransfer';
import type { Child, ParentOrder } from './types';
describe('CRM order transfer', () => {
  const order = {id:'order-1', child_id:'crm-child', status:'new',selected_items:[{id:'crm-service',name:'Фото',price:350,quantity:2,comment:'Две копии'}],total_amount:700} as ParentOrder;
  it('preserves original student/service identities, quantities and comments', () => {
    const student=studentRecord({id:'local-child',crm_source_id:'crm-child',first_name:'Сумайя',last_name:'Вакаева'} as Child,'crm-class',[order]);
    expect(student.id).toBe('crm-child');
    // Matching uses the normalized original identity supplied by the exporter.
    const matched=studentRecord({id:'crm-child',crm_source_id:'crm-child'} as Child,'crm-class',[order]);
    expect(matched.selectedServices).toEqual([expect.objectContaining({serviceId:'crm-service',quantity:2,comment:'Две копии',name:'Фото',price:350})]);
    expect(orderRecord(order).items[0]).toMatchObject({id:'order_crm-child_crm-service',serviceId:'crm-service',quantity:2,comment:'Две копии'});
  });
  it('preserves an individual request, catalog reference and screenshot identity', () => {
    const customOrder = {
      ...order,
      order_number: 'VS-INDIVIDUAL',
      selected_items: [{
        id: 'custom-request', name: 'Индивидуальный образ', price: 0, quantity: 1,
        comment: 'Форма спасателя как на скрине', reference_path: 'owner/request/screen.webp',
        reference_name: 'screen.webp', reference_content_type: 'image/webp',
        reference_service_id: 'service-rescuer', reference_service_name: 'Горный спасатель'
      }]
    } as ParentOrder;
    const exported = orderRecord(customOrder);
    expect(exported.vakhaOrderNumber).toBe('VS-INDIVIDUAL');
    expect(exported.items[0]).toMatchObject({
      requestType: 'custom', comment: 'Форма спасателя как на скрине',
      referenceServiceId: 'service-rescuer', referenceServiceName: 'Горный спасатель',
      referenceFileName: 'screen.webp'
    });
    expect(exported.items[0].referenceMediaId).toContain('parent_request_');
  });
  it('exports a parent wish and photo animation add-on with the regular service', () => {
    const wishedOrder = {...order, selected_items: [{...order.selected_items[0], comment: 'С ламинацией (защиты)', parent_comment: 'С мячом в руках', video_addon_requested: true, parent_video_name: 'interview.mp4'}]} as ParentOrder;
    expect(orderRecord(wishedOrder).items[0]).toMatchObject({
      parentComment: 'С мячом в руках', videoAddonRequested: true, parentVideoName: 'interview.mp4',
      comment: 'С ламинацией (защиты) · Оживление фото (+500 ₽) · Пожелание родителя: С мячом в руках'
    });
    expect(studentRecord({id:'crm-child',crm_source_id:'crm-child'} as Child, 'crm-class', [wishedOrder]).selectedServices[0]).toMatchObject({parentComment:'С мячом в руках',videoAddonRequested:true,parentVideoName:'interview.mp4'});
  });
  it('builds a public class link for CRM',()=>expect(crmParentCatalogUrl('class token','https://waystudia.github.io/vakha.studia')).toBe('https://waystudia.github.io/?/p/class%20token'));
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
  it('bundles every private parent screenshot and links each request to the imported CRM order', async () => {
    prepare();
    mockReferenceDownload.mockResolvedValue({data:new Blob(['reference'],{type:'image/webp'}),error:null});
    vi.mocked(loadClass).mockResolvedValue({
      school, schoolClass:classes[0], children:[{id:'local-child',crm_source_id:'crm-child',first_name:'Имя',last_name:'Фамилия'}],
      orders:[{id:'order-custom',order_number:'VS-CUSTOM',child_id:'local-child',status:'new',created_at:'2026-11-08',selected_items:[
        {id:'custom-one',name:'Индивидуальный образ',price:0,quantity:1,comment:'Мяч в руках',reference_path:'owner/request/ball.webp',reference_name:'ball.webp',reference_content_type:'image/webp',reference_service_id:'football',reference_service_name:'Футболист'},
        {id:'custom-two',name:'Индивидуальный образ',price:0,quantity:1,comment:'Как на скрине',reference_path:'owner/request/screen.webp',reference_name:'screen.webp',reference_content_type:'image/webp',reference_service_id:'dragon',reference_service_name:'Парень с драконом'}
      ],total_amount:0}]
    } as never);
    const {zip}=await buildCrmTransfer({kind:'class',id:'c1'});
    const data=JSON.parse(await zip.file('data.json')!.async('string'));
    expect(data.media).toHaveLength(2);
    expect(data.media[0]).toMatchObject({studentId:'crm-child',purpose:'parent_request_reference',mimeType:'image/webp'});
    expect(data.orders[0].items).toEqual(expect.arrayContaining([
      expect.objectContaining({requestType:'custom',comment:'Мяч в руках',referenceServiceName:'Футболист',referenceMediaId:data.media[0].id}),
      expect.objectContaining({requestType:'custom',comment:'Как на скрине',referenceServiceName:'Парень с драконом',referenceMediaId:data.media[1].id})
    ]));
    expect(await zip.file(`media/student_files/${data.media[0].id}/${data.media[0].fileName}`)!.async('string')).toBe('reference');
    expect(await zip.file(`media/student_files/${data.media[1].id}/${data.media[1].fileName}`)!.async('string')).toBe('reference');
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
