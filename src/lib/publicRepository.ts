import type { PublicClassPayload, PublicOrderPayload, PublicOrderResult } from './types';
import { catalogPreviewUrl } from './catalogPreview';
import { normalizeCrmOrder, normalizeCrmPublicItem } from './crmPublicPayload';
import { crmPublicClient } from './crmPublicClient';
export { PublicApiError } from './crmPublicClient';
const crm = import.meta.env.VITE_CRM_MODE === 'true';
export const supportsPublicChildRegistration = true;
export const isCrmPublicMode = crm;
async function crmOrder(path: string, body: Record<string, unknown> | FormData): Promise<PublicOrderResult> {
  return normalizeCrmOrder(await crmPublicClient.mutate<PublicOrderResult>(path, body));
}
export type PublicChild = PublicClassPayload['children'][number];
export type ChildPreview = {matches: PublicChild[]};
export async function previewPublicChild(input: {token: string; firstName: string; lastName: string}): Promise<ChildPreview> {
  if (!crm) return {matches: []};
  return crmPublicClient.preview('classes/' + encodeURIComponent(input.token) + '/children/preview', {firstName: input.firstName, lastName: input.lastName});
}
export async function getPublicClass(token: string): Promise<PublicClassPayload | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15000);
  let payload: PublicClassPayload | null;
  try {
    if (crm) payload = await crmPublicClient.get<PublicClassPayload | null>('classes/'+encodeURIComponent(token));
    else {
      const response = await fetch(import.meta.env.VITE_SUPABASE_URL + '/rest/v1/rpc/get_public_class', {method:'POST', headers:{apikey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, 'Content-Type':'application/json'}, body:JSON.stringify({p_token:token}), signal:controller.signal});
      if (!response.ok) throw new Error('Сервер временно недоступен. Повторите загрузку.');
      payload = await response.json();
    }
  } catch (error) { if (crm) throw error; throw new Error('Не удалось получить данные класса. Проверьте подключение и повторите загрузку.'); }
  finally { window.clearTimeout(timer); }
  if (!payload) return null;
  if (crm) return { ...payload, children: payload.children.map(child => ({...child, orders: child.orders?.map(order => ({...order, revision: order.revision ?? 1, items: order.items.map(normalizeCrmPublicItem)}))})), catalog: payload.catalog.map(item => ({...item, preview_url: catalogPreviewUrl(item)})) };
  const referencePaths = payload.children.flatMap(child => child.orders?.flatMap(order => order.items.flatMap(item => [item.reference_path, item.parent_video_path].filter((path): path is string => Boolean(path)))) || []);
  let previews: Record<string, string> = {};
  if (referencePaths.length) {
    let previewTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        (await import('./supabase')).supabase.functions.invoke('submit-parent-request', { body: { action: 'signPreviews', token } }),
        new Promise<null>(resolve => { previewTimer = setTimeout(() => resolve(null), 3000); }),
      ]);
      previews = result?.data?.previews || {};
    } catch { /* Optional private previews must not block the class list. */ }
    finally { clearTimeout(previewTimer); }
  }
  return {
    ...payload,
    children: payload.children.map(child => ({...child, orders: child.orders?.map(order => ({...order, items: order.items.map(item => ({...item, ...(item.reference_path && previews[item.reference_path] ? {preview_url: previews[item.reference_path]} : {}), ...(item.parent_video_path && previews[item.parent_video_path] ? {parent_video_url: previews[item.parent_video_path]} : {})}))}))})),
    catalog: payload.catalog.map(item => ({...item, preview_url: catalogPreviewUrl(item)})),
  };
}
export async function getPublicOrder(token: string): Promise<PublicOrderPayload | null> {
  if (crm) { const order = await crmPublicClient.get<PublicOrderPayload | null>('orders/'+encodeURIComponent(token)); return order ? normalizeCrmOrder(order) : null; }
  return (await import('./repository')).getPublicOrder(token);
}
export async function submitPublicOrder(input: {token: string; childId: string; itemIds: string[]; withoutLaminationIds: string[]; requestKey: string; note: string; itemPreferences?: Record<string, {comment?: string; videoAddonRequested?: boolean}>; revision?: number}): Promise<PublicOrderResult> {
  if (!crm) return (await import('./repository')).submitPublicOrder(input);
  const {token, ...body} = input;
  return crmOrder('classes/'+encodeURIComponent(token), {...body, revision: input.revision ?? 0});
}
export async function attachPublicServiceVideo(input: {token: string; childId: string; itemId: string; video: File; revision?: number}): Promise<PublicOrderResult> {
  const form = new FormData();
  form.set('mode', 'attachServiceVideo'); form.set('token', input.token); form.set('childId', input.childId); form.set('itemId', input.itemId);
  form.set('video', input.video, input.video.name);
  if (crm) {
    form.delete('mode'); form.delete('token'); form.delete('childId');
    form.set('revision', String(input.revision ?? 0));
    return crmOrder('classes/' + encodeURIComponent(input.token) + '/children/' + encodeURIComponent(input.childId) + '/service-video', form);
  }
  const { data, error } = await (await import('./supabase')).supabase.functions.invoke('submit-parent-request', { body: form });
  if (error) throw new Error(error.message || 'Не удалось прикрепить видео. Повторите попытку.');
  if (data?.error) throw new Error(data.error);
  return data as PublicOrderResult;
}
export async function submitPublicCustomRequest(input: {token: string; childId: string; message: string; requestKey: string; catalogItemId?: string; referenceFile?: File | null; revision?: number}): Promise<PublicOrderResult> {
  if (crm) {
    const path = 'classes/' + encodeURIComponent(input.token) + '/children/' + encodeURIComponent(input.childId) + '/custom-request';
    if (!input.referenceFile) return crmOrder(path, {message: input.message, catalogItemId: input.catalogItemId, revision: input.revision ?? 0});
    const form = new FormData();
    form.set('message', input.message); form.set('revision', String(input.revision ?? 0));
    if (input.catalogItemId) form.set('catalogItemId', input.catalogItemId);
    form.set('reference', input.referenceFile, input.referenceFile.name);
    return crmOrder(path, form);
  }
  if (input.referenceFile || input.catalogItemId) {
    const form = new FormData();
    form.set('token', input.token); form.set('childId', input.childId); form.set('message', input.message); form.set('requestKey', input.requestKey);
    if (input.catalogItemId) form.set('catalogItemId', input.catalogItemId);
    if (input.referenceFile) form.set('reference', input.referenceFile, input.referenceFile.name);
    const { data, error } = await (await import('./supabase')).supabase.functions.invoke('submit-parent-request', { body: form });
    if (error) throw new Error(error.message || 'Не удалось прикрепить референс. Повторите попытку.');
    if (data?.error) throw new Error(data.error);
    return data as PublicOrderResult;
  }
  return (await import('./repository')).submitPublicCustomRequest(input);
}
export async function cancelPublicOrder(input: {token: string; childId: string; revision?: number}): Promise<PublicOrderResult> {
  if (!crm) return (await import('./repository')).cancelPublicOrder(input);
  return crmOrder('classes/'+encodeURIComponent(input.token)+'/children/'+encodeURIComponent(input.childId)+'/order/cancel', {revision: input.revision ?? 0});
}

export async function addPublicChild(input: {token: string; firstName: string; lastName: string}): Promise<{child: PublicClassPayload['children'][number]; duplicate: boolean}> {
  if (crm) return crmPublicClient.mutate('classes/' + encodeURIComponent(input.token) + '/children', {firstName: input.firstName, lastName: input.lastName});
  const {supabase} = await import('./supabase');
  const { data, error } = await supabase.rpc('add_public_class_child', {p_token: input.token, p_first_name: input.firstName, p_last_name: input.lastName});
  if (error) throw error;
  return data;
}
