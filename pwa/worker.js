/* Only the public catalog and static application shell are available offline. */
const SHELL = __SHELL_CACHE__;
const PRECACHE = __PRECACHE__;
const SHELL_PREFIX = SHELL.replace(/[a-f0-9]{16}$/, '');
const BASE = new URL(self.registration.scope);
const PUBLIC_CACHE = 'vakha-catalog-v1-';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(PRECACHE)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await Promise.all((await caches.keys()).filter(name => name.startsWith(SHELL_PREFIX) && name !== SHELL).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SHELL_READY') event.waitUntil(caches.open(SHELL).then(async cache => {
    const ready = (await Promise.all(PRECACHE.map(url => cache.match(url)))).every(Boolean);
    event.ports[0]?.postMessage({ ready });
  }));
});
async function catalogMatch(request) {
  for (const name of (await caches.keys()).filter(name => name.startsWith(PUBLIC_CACHE)).reverse()) {
    const match = await (await caches.open(name)).match(request.url);
    if (match) return match;
  }
}
async function partialResponse(response, range) {
  const bytes = await response.arrayBuffer();
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  let start = match?.[1] ? Number(match[1]) : Math.max(0, bytes.byteLength - Number(match?.[2]));
  let end = match?.[1] ? (match[2] ? Number(match[2]) : bytes.byteLength - 1) : bytes.byteLength - 1;
  if (!match || (!match[1] && !match[2]) || start >= bytes.byteLength || end < start) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${bytes.byteLength}` } });
  }
  end = Math.min(end, bytes.byteLength - 1);
  return new Response(bytes.slice(start, end + 1), { status: 206, headers: {
    'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
    'Content-Length': String(end - start + 1), 'Content-Range': `bytes ${start}-${end}/${bytes.byteLength}`, 'Accept-Ranges': 'bytes',
  } });
}
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const local = url.origin === BASE.origin && url.pathname.startsWith(BASE.pathname);
  const route = local ? url.pathname.slice(BASE.pathname.length) : '';
  // Never cache API calls, authentication, children, orders or administrator HTML.
  if (request.mode === 'navigate') {
    if (route !== 'offline-catalog' && !/^catalog\/[^/]+\/?$/.test(route)) return;
    event.respondWith((async () => {
      const shell = await caches.open(SHELL);
      return await shell.match(new URL('index.html', BASE).href) || fetch(request);
    })());
    return;
  }
  const staticAsset = local && (route.startsWith('assets/') || route.startsWith('pwa/') || route === 'catalog.webmanifest');
  event.respondWith((async () => {
    if (staticAsset) return await (await caches.open(SHELL)).match(request.url) || fetch(request);
    const saved = await catalogMatch(request);
    if (saved) return request.headers.has('Range') ? partialResponse(saved, request.headers.get('Range')) : saved;
    return fetch(request);
  })());
});
