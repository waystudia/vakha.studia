import type { PublicClassPayload, PublicOrderPayload, PublicOrderResult } from './types';
const crm = import.meta.env.VITE_CRM_MODE === 'true';
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch('/api/v1/public/' + path, {method: body ? 'POST' : 'GET', cache: 'no-store', credentials: 'omit', headers: body ? {'Content-Type':'application/json'} : {}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000)});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Не удалось связаться с сервером. Повторите отправку.');
  return data;
}
export async function getPublicClass(token: string): Promise<PublicClassPayload | null> {
  return crm ? request('classes/'+encodeURIComponent(token)) : (await import('./repository')).getPublicClass(token);
}
export async function getPublicOrder(token: string): Promise<PublicOrderPayload | null> {
  return crm ? request('orders/'+encodeURIComponent(token)) : (await import('./repository')).getPublicOrder(token);
}
export async function submitPublicOrder(input: {token: string; childId: string; itemIds: string[]; withoutLaminationIds: string[]; requestKey: string; note: string}): Promise<PublicOrderResult> {
  if (!crm) return (await import('./repository')).submitPublicOrder(input);
  const storageKey='vakha-order:'+input.token+':'+input.childId;
  let saved: {key:string; items:string[]; withoutLamination?:string[]} | null=null;
  try { saved=JSON.parse(localStorage.getItem(storageKey)||'null'); } catch { /* Storage can be unavailable. */ }
  if (saved && saved.items.join('|')===[...input.itemIds].sort().join('|') && (saved.withoutLamination || []).join('|')===[...input.withoutLaminationIds].sort().join('|')) input={...input,requestKey:saved.key};
  try { localStorage.setItem(storageKey,JSON.stringify({key:input.requestKey,items:[...input.itemIds].sort(),withoutLamination:[...input.withoutLaminationIds].sort()})); } catch { /* The in-memory key still protects retries. */ }
  return request('classes/'+encodeURIComponent(input.token),input);
}
