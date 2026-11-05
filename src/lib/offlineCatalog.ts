import type { PublicCatalogPayload } from './types';
import { catalogMediaUrl } from './mediaUrl';

export const CATALOG_CACHE_PREFIX = 'vakha-catalog-v1-';
const recordUrl = () => new URL(`${import.meta.env.BASE_URL}offline-record`, location.origin).href;
export type SavedCatalog = { token: string; savedAt: string; files: number; bytes: number; data: PublicCatalogPayload };
export type SaveProgress = { done: number; total: number; bytes: number };
export const offlineCatalogLink = (token: string) => `${import.meta.env.BASE_URL}catalog/${encodeURIComponent(token)}?offline=1`;
export function catalogTokenFromLink(value: string, origin = location.origin, base = import.meta.env.BASE_URL) {
  try {
    const url = new URL(value.trim(), origin);
    if (url.origin !== origin || !url.pathname.startsWith(`${base}catalog/`)) return null;
    const token = url.pathname.slice(`${base}catalog/`.length).replace(/\/$/, '');
    return /^[a-zA-Z0-9_-]+$/.test(token) ? token : null;
  } catch { return null; }
}

export async function registerCatalogWorker() {
  if (!('serviceWorker' in navigator)) throw new Error('Этот браузер не поддерживает офлайн-каталог. Откройте ссылку в Safari или Chrome.');
  if (!import.meta.env.PROD) throw new Error('Сохранение офлайн доступно в опубликованной версии.');
  const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL });
  let readyTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_resolve, reject) => { readyTimer = setTimeout(() => reject(new Error('Не удалось сохранить файлы приложения. Проверьте интернет и повторите.')), 30000); }),
    ]);
  } finally { clearTimeout(readyTimer); }
  const worker = registration.active;
  if (!worker) throw new Error('Подготовка приложения ещё не завершена. Повторите сохранение.');
  const ready = await new Promise<boolean>((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); reject(new Error('Не удалось проверить офлайн-приложение. Повторите сохранение.')); }, 20000);
    channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data?.ready === true); };
    worker.postMessage({ type: 'SHELL_READY' }, [channel.port2]);
  });
  if (!ready) throw new Error('Файлы приложения сохранены не полностью. Обновите страницу и повторите сохранение.');
}

export function catalogAssets(data: PublicCatalogPayload) {
  return [...new Set([
    ...data.catalog.flatMap(item => [item.preview_url, item.preview_video_url ? catalogMediaUrl(item.preview_video_url) : '']),
    data.watermark.image || '',
  ].filter(url => /^https?:\/\//.test(url)))];
}

export async function savedCatalogs(): Promise<SavedCatalog[]> {
  if (!('caches' in window)) return [];
  const records = await Promise.all((await caches.keys()).filter(name => name.startsWith(CATALOG_CACHE_PREFIX)).map(async name => {
    const response = await (await caches.open(name)).match(recordUrl());
    return response ? response.json() as Promise<SavedCatalog> : null;
  }));
  const unique = new Map<string, SavedCatalog>();
  for (const record of records.filter(Boolean).sort((a, b) => b!.savedAt.localeCompare(a!.savedAt))) if (record && !unique.has(record.token)) unique.set(record.token, record);
  return [...unique.values()];
}
export async function loadSavedCatalog(token: string) {
  const record = (await savedCatalogs()).find(record => record.token === token);
  if (!record) return null;
  const urls = catalogAssets(record.data);
  const names = (await caches.keys()).filter(name => name.startsWith(`${CATALOG_CACHE_PREFIX}${token}-`));
  // Do not advertise a complete download after the browser has evicted its media.
  for (const url of urls) {
    let found = false;
    for (const name of names) if (await (await caches.open(name)).match(url)) { found = true; break; }
    if (!found) return null;
  }
  return record;
}

export async function saveCatalog(token: string, data: PublicCatalogPayload, progress: (value: SaveProgress) => void, signal: AbortSignal) {
  await registerCatalogWorker();
  await navigator.storage?.persist?.().catch(() => false);
  const urls = catalogAssets(data);
  const name = `${CATALOG_CACHE_PREFIX}${token}-${Date.now()}`;
  const cache = await caches.open(name);
  let bytes = 0;
  try {
    for (const [index, url] of urls.entries()) {
      signal.throwIfAborted();
      const response = await fetch(url, { credentials: 'omit', cache: 'no-store', signal });
      if (response.status !== 200 || response.type === 'opaque') throw new Error(`Не удалось сохранить файл ${index + 1} из ${urls.length}. Проверьте интернет и повторите.`);
      const blob = await response.blob();
      if (!blob.type.startsWith('image/') && !blob.type.startsWith('video/')) throw new Error('Вместо фото или видео получен неверный файл. Повторите сохранение.');
      if (!blob.size) throw new Error('Получен пустой файл. Повторите сохранение.');
      bytes += blob.size;
      await cache.put(url, new Response(blob, { headers: { 'Content-Type': blob.type } }));
      progress({ done: index + 1, total: urls.length, bytes });
    }
    signal.throwIfAborted();
    // The readiness record is committed only after every photo and video succeeds.
    const record: SavedCatalog = { token, savedAt: new Date().toISOString(), files: urls.length, bytes, data: { ...data, whatsapp: undefined } };
    await cache.put(recordUrl(), new Response(JSON.stringify(record), { headers: { 'Content-Type': 'application/json' } }));
    const old = (await caches.keys()).filter(key => key.startsWith(`${CATALOG_CACHE_PREFIX}${token}-`) && key !== name).sort().reverse();
    const complete = [];
    for (const key of old) if (await (await caches.open(key)).match(recordUrl())) complete.push(key);
    await Promise.allSettled(complete.slice(1).map(key => caches.delete(key)));
    return record;
  } catch (error) {
    await caches.delete(name);
    if (error instanceof DOMException && error.name === 'QuotaExceededError') throw new Error('На устройстве недостаточно места. Освободите память и повторите сохранение.');
    throw error;
  }
}
