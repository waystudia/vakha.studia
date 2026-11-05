import { Blob } from "node:buffer";
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

function worker() {
  const handlers = new Map<string, (event: { request: Request; respondWith: (promise: Promise<Response>) => void }) => void>();
  const media = new Map<string, Response>();
  const shell = new Map([['https://studio.test/app/index.html', new Response('<html>catalog</html>', { headers: { 'Content-Type': 'text/html' } })]]);
  const network = vi.fn(() => Promise.reject(new Error('offline')));
  runInNewContext(readFileSync('pwa/worker.js', 'utf8').replace('__SHELL_CACHE__', '"shell"').replace('__PRECACHE__', '[]'), {
    self: { registration: { scope: 'https://studio.test/app/' }, addEventListener: (name: string, callback: typeof handlers extends Map<string, infer V> ? V : never) => handlers.set(name, callback) },
    caches: { keys: async () => ['shell', 'vakha-catalog-v1-token-1'], open: async (name: string) => ({ match: async (url: string) => (name === 'shell' ? shell : media).get(url)?.clone() }) },
    URL, Response, Blob, fetch: network,
  });
  async function request(url: string, headers?: Record<string, string>, mode?: string) {
    let response: Promise<Response> | undefined;
    const input = new Request(url, { headers });
    if (mode) Object.defineProperty(input, 'mode', { value: mode });
    handlers.get('fetch')!({ request: input, respondWith: promise => { response = promise; } });
    return response;
  }
  return { media, request, network };
}

describe('catalog-only service worker', () => {
  it('loads the current online shell rather than pinning an old installed interface', async () => {
    const w = worker();
    w.network.mockResolvedValueOnce(new Response('<html>updated</html>') as never);
    const response = await w.request('https://studio.test/app/catalog/token', undefined, 'navigate');
    expect(await response?.text()).toContain('updated');
  });

  it('opens the saved launcher/catalog offline but never supplies admin or parent HTML', async () => {
    const app = worker();
    expect(await (await app.request('https://studio.test/app/offline-catalog', {}, 'navigate'))?.text()).toContain('catalog');
    expect(await (await app.request('https://studio.test/app/catalog/token', {}, 'navigate'))?.text()).toContain('catalog');
    expect(await app.request('https://studio.test/app/admin/orders', {}, 'navigate')).toBeUndefined();
    expect(await app.request('https://studio.test/app/p/private-class', {}, 'navigate')).toBeUndefined();
  });
  it('serves video byte ranges entirely from saved media, including suffix and invalid ranges', async () => {
    const app = worker(); const url = 'https://media.test/video.mp4?v=20261027';
    app.media.set(url, new Response('0123456789', { headers: { 'Content-Type': 'video/mp4' } }));
    const part = await app.request(url, { Range: 'bytes=2-5' });
    expect(part?.status).toBe(206); expect(await part?.text()).toBe('2345');
    expect(part?.headers.get('Content-Range')).toBe('bytes 2-5/10');
    expect(await (await app.request(url, { Range: 'bytes=-3' }))?.text()).toBe('789');
    expect((await app.request(url, { Range: 'bytes=50-' }))?.status).toBe(416);
    expect(app.network).not.toHaveBeenCalled();
  });
});
