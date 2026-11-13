import {expect,it} from 'vitest';
import {isCustomPublicItem,publicOrderTotal} from './publicOrderPrice';
import {normalizeCrmPublicItem} from './crmPublicPayload';
it('shows an unpriced custom request as requiring agreement, even alongside paid services',()=>{
 expect(publicOrderTotal({selected_items:[{price_pending:true}] as never,total_amount:0})).toBe('По согласованию со студией');
 expect(publicOrderTotal({selected_items:[{price_pending:true}] as never,total_amount:350})).toContain('+ по согласованию');
});
it('recognizes a custom request referencing an existing catalog ID',()=>expect(isCustomPublicItem({id:'existing-service',name:'Фото',requestType:'custom'})).toBe(true));
it('restores CRM camelCase wishes without changing signed URLs, IDs or prices',()=>{
 const item={name:'Фото',id:'stable',price:800,parentComment:'С мячом',videoAddonRequested:true,withoutLamination:true,preview_url:'https://media.test/?X-Amz-Signature=unchanged'};
 expect(normalizeCrmPublicItem(item)).toMatchObject({...item,parent_comment:'С мячом',video_addon_requested:true});
});
