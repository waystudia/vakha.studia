// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogTokenFromLink, catalogAssets, loadSavedCatalog, saveCatalog, savedCatalogs } from './offlineCatalog';
import type { PublicCatalogPayload } from './types';

const data = { company_name: 'Studio', whatsapp: { phone: 'private-contact-not-needed-offline' }, watermark: { text: 'VS', image: '', opacity: .3 }, catalog: [{ id: 'one', name: 'Фото', price: 350, category: 'Фото', gender: 'unisex', type: 'photo', preview_url: 'https://example.com/photo.webp', preview_video_url: 'https://example.com/video.mp4', parent_preview_mode: 'print', description: '', short_description: '' }] } as PublicCatalogPayload;
let storage: Map<string, Map<string, Response>>;
beforeEach(() => {
  vi.stubEnv('PROD', true);
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('location', new URL('https://studio.test/'));
  storage = new Map();
  vi.stubGlobal('caches', {
    keys: async () => [...storage.keys()], delete: async (name: string) => storage.delete(name),
    open: async (name: string) => {
      if (!storage.has(name)) storage.set(name, new Map());
      return { put: async (url: string, response: Response) => { storage.get(name)!.set(url, response.clone()); }, match: async (url: string) => storage.get(name)!.get(url)?.clone() };
    },
  });
  const worker = { postMessage: (_data: unknown, ports: MessagePort[]) => { ports[0].postMessage({ ready: true }); ports[0].close(); } };
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register: async () => ({ active: worker }), ready: Promise.resolve({ active: worker }) } });
  vi.stubGlobal('fetch', vi.fn(async () => new Response('media', { headers: { 'Content-Type': 'image/webp' } })));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('complete public catalog downloads', () => {
  it('accepts only the general catalog from this application, including its hosted base path', () => {
    expect(catalogTokenFromLink('https://studio.test/app/catalog/abc123?presentation=1', 'https://studio.test', '/app/')).toBe('abc123');
    expect(catalogTokenFromLink('https://other.test/app/catalog/abc123', 'https://studio.test', '/app/')).toBeNull();
    expect(catalogTokenFromLink('https://studio.test/app/p/child-data', 'https://studio.test', '/app/')).toBeNull();
    expect(catalogTokenFromLink('javascript:alert(1)', 'https://studio.test', '/app/')).toBeNull();
  });
  it('downloads the exact video URL used by the player and commits public-only data', async () => {
    expect(catalogAssets(data)).toEqual(['https://example.com/photo.webp', 'https://example.com/video.mp4?v=20261027']);
    const result = await saveCatalog('token', data, () => {}, new AbortController().signal);
    expect(result.files).toBe(2);
    expect(result.data.whatsapp).toBeUndefined();
    expect((await loadSavedCatalog('token'))?.data.catalog).toEqual(data.catalog);
  });
  it('keeps the previous complete version after an interrupted update', async () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(1).mockReturnValueOnce(2);
    await saveCatalog('token', data, () => {}, new AbortController().signal);
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network lost'));
    await expect(saveCatalog('token', data, () => {}, new AbortController().signal)).rejects.toThrow('network lost');
    expect(await savedCatalogs()).toHaveLength(1);
    expect(await loadSavedCatalog('token')).not.toBeNull();
  });
  it('does not claim readiness when a saved media file has been evicted', async () => {
    await saveCatalog('token', data, () => {}, new AbortController().signal);
    for (const cache of storage.values()) cache.delete('https://example.com/video.mp4?v=20261027');
    expect(await loadSavedCatalog('token')).toBeNull();
  });
});
