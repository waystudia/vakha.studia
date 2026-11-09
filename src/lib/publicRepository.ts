import type { PublicClassPayload, PublicOrderPayload, PublicOrderResult } from './types';
import { catalogPreviewUrl } from './catalogPreview';
import { supabase } from './supabase';
const crm = import.meta.env.VITE_CRM_MODE === 'true';
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch('/api/v1/public/' + path, {method: body ? 'POST' : 'GET', cache: 'no-store', credentials: 'omit', headers: body ? {'Content-Type':'application/json'} : {}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000)});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Не удалось связаться с сервером. Повторите отправку.');
  return data;
}
export async function getPublicClass(token: string): Promise<PublicClassPayload | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15000);
  let payload: PublicClassPayload | null;
  try {
    if (crm) payload = await request<PublicClassPayload | null>('classes/'+encodeURIComponent(token));
    else {
      const response = await fetch(import.meta.env.VITE_SUPABASE_URL + '/rest/v1/rpc/get_public_class', {method:'POST', headers:{apikey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, 'Content-Type':'application/json'}, body:JSON.stringify({p_token:token}), signal:controller.signal});
      if (!response.ok) throw new Error('Сервер временно недоступен. Повторите загрузку.');
      payload = await response.json();
    }
  } catch { throw new Error('Не удалось получить данные класса. Проверьте подключение и повторите загрузку.'); }
  finally { window.clearTimeout(timer); }
  if (!payload) return null;
  const referencePaths = payload.children.flatMap(child => child.orders?.flatMap(order => order.items.flatMap(item => [item.reference_path, item.parent_video_path].filter((path): path is string => Boolean(path)))) || []);
  let previews: Record<string, string> = {};
  if (referencePaths.length) {
    let previewTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        supabase.functions.invoke('submit-parent-request', { body: { action: 'signPreviews', token } }),
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
  return crm ? request('orders/'+encodeURIComponent(token)) : (await import('./repository')).getPublicOrder(token);
}
export async function submitPublicOrder(input: {token: string; childId: string; itemIds: string[]; withoutLaminationIds: string[]; requestKey: string; note: string; itemPreferences?: Record<string, {comment?: string; videoAddonRequested?: boolean}>}): Promise<PublicOrderResult> {
  if (!crm) return (await import('./repository')).submitPublicOrder(input);
  const storageKey='vakha-order:'+input.token+':'+input.childId;
  let saved: {key:string; items:string[]; withoutLamination?:string[]} | null=null;
  try { saved=JSON.parse(localStorage.getItem(storageKey)||'null'); } catch { /* Storage can be unavailable. */ }
  if (saved && saved.items.join('|')===[...input.itemIds].sort().join('|') && (saved.withoutLamination || []).join('|')===[...input.withoutLaminationIds].sort().join('|')) input={...input,requestKey:saved.key};
  try { localStorage.setItem(storageKey,JSON.stringify({key:input.requestKey,items:[...input.itemIds].sort(),withoutLamination:[...input.withoutLaminationIds].sort()})); } catch { /* The in-memory key still protects retries. */ }
  return request('classes/'+encodeURIComponent(input.token),input);
}
export async function attachPublicServiceVideo(input: {token: string; childId: string; itemId: string; video: File}): Promise<PublicOrderResult> {
  const form = new FormData();
  form.set('mode', 'attachServiceVideo'); form.set('token', input.token); form.set('childId', input.childId); form.set('itemId', input.itemId);
  form.set('video', input.video, input.video.name);
  const { data, error } = await supabase.functions.invoke('submit-parent-request', { body: form });
  if (error) throw new Error(error.message || 'Не удалось прикрепить видео. Повторите попытку.');
  if (data?.error) throw new Error(data.error);
  return data as PublicOrderResult;
}
export async function submitPublicCustomRequest(input: {token: string; childId: string; message: string; requestKey: string; catalogItemId?: string; referenceFile?: File | null}): Promise<PublicOrderResult> {
  if (input.referenceFile || input.catalogItemId) {
    const form = new FormData();
    form.set('token', input.token); form.set('childId', input.childId); form.set('message', input.message); form.set('requestKey', input.requestKey);
    if (input.catalogItemId) form.set('catalogItemId', input.catalogItemId);
    if (input.referenceFile) form.set('reference', input.referenceFile, input.referenceFile.name);
    const { data, error } = await supabase.functions.invoke('submit-parent-request', { body: form });
    if (error) throw new Error(error.message || 'Не удалось прикрепить референс. Повторите попытку.');
    if (data?.error) throw new Error(data.error);
    return data as PublicOrderResult;
  }
  if (!crm) return (await import('./repository')).submitPublicCustomRequest(input);
  return request('classes/'+encodeURIComponent(input.token)+'/children/'+encodeURIComponent(input.childId)+'/custom-request', input);
}
export async function cancelPublicOrder(input: {token: string; childId: string}): Promise<PublicOrderResult> {
  if (!crm) return (await import('./repository')).cancelPublicOrder(input);
  return request('classes/'+encodeURIComponent(input.token)+'/children/'+encodeURIComponent(input.childId)+'/order/cancel', {});
}
