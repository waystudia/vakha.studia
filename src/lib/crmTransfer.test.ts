import { describe, it, expect } from 'vitest';
import { studentRecord, orderRecord } from './crmTransfer';
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
});
