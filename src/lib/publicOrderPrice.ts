import { money } from './helpers';
import type { PublicOrderResult, PublicSelectedOrderItem } from './types';
export function isCustomPublicItem(item: PublicSelectedOrderItem) {
  return item.requestType === 'custom' || item.type === 'custom' || Boolean(item.id?.startsWith('custom-request'));
}
export function publicOrderTotal(order: Pick<PublicOrderResult, 'selected_items' | 'total_amount'>) {
  return order.selected_items.some(item => item.price_pending)
    ? (order.total_amount > 0 ? `${money(order.total_amount)} + по согласованию` : 'По согласованию со студией')
    : money(order.total_amount);
}
