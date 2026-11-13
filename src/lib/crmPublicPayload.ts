import type { PublicOrderResult, PublicSelectedOrderItem } from './types';
/** Keep CRM IDs, prices, media IDs and signed URLs exactly as supplied. */
export function normalizeCrmPublicItem<T extends PublicSelectedOrderItem>(item: T): T {
  return {...item,
    parent_comment: item.parent_comment ?? item.parentComment,
    video_addon_requested: item.video_addon_requested ?? item.videoAddonRequested,
    type: item.type || (item.requestType === 'custom' ? 'custom' : item.type),
  };
}
export function normalizeCrmOrder<T extends PublicOrderResult>(order: T): T {
  return {...order, selected_items: order.selected_items.map(normalizeCrmPublicItem)};
}
