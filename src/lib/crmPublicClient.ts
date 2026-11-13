import { publicQueueChanged, publicQueueStore, type PendingPublicRequest, type PublicQueueStore, type StoredBody } from './crmPublicQueue';
export class PublicApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = 'PublicApiError'; }
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).filter(([key]) => key !== 'requestKey').sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => JSON.stringify(key) + ':' + canonical(val)).join(',') + '}';
  return JSON.stringify(value) ?? 'null';
}
async function digest(value: BufferSource) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', value)), n => n.toString(16).padStart(2, '0')).join('');
}
async function fingerprint(path: string, body: StoredBody) {
  let content: unknown = body.kind === 'json' ? body.value : await Promise.all(body.entries.filter(([key]) => key !== 'requestKey').map(async ([key, value]) => [key, typeof value === 'string' ? value : { name: value.name, type: value.type, hash: await digest(await value.arrayBuffer()) }]));
  if (Array.isArray(content)) content = content.sort(([a], [b]) => String(a).localeCompare(String(b)));
  return digest(new TextEncoder().encode(path + '\n' + canonical(content)));
}
function restoreBody(body: StoredBody): BodyInit {
  if (body.kind === 'json') return JSON.stringify(body.value);
  const form = new FormData();
  for (const [key, value] of body.entries) {
    if (typeof value === 'string') form.append(key, value);
    else form.append(key, value, value.name);
  }
  return form;
}
/** No credentials, automatic retries, background worker or Supabase fallback. */
export function createCrmPublicClient(store: PublicQueueStore = publicQueueStore, transport: typeof fetch = (...args) => fetch(...args)) {
  const inFlight = new Map<string, Promise<unknown>>();
  let prepareTail: Promise<unknown> = Promise.resolve();
  async function send<T>(path: string, body?: StoredBody): Promise<T> {
    if (!navigator.onLine) throw new PublicApiError('Нет интернета. Вернитесь на сайт и повторите попытку после подключения.', 0);
    let response: Response;
    try {
      response = await transport('/api/v1/public/' + path, { method: body ? 'POST' : 'GET', cache: 'no-store', credentials: 'omit', headers: body?.kind === 'json' ? { 'Content-Type': 'application/json' } : {}, body: body ? restoreBody(body) : undefined, signal: AbortSignal.timeout(20000) });
    } catch { throw new PublicApiError('Не удалось получить ответ сервера. Повторите отправку — её номер сохранён, повтор не создаст дубль.', 0); }
    let data: unknown;
    try { data = await response.json(); }
    catch { throw new PublicApiError('Сервер вернул неполный ответ. Повторите попытку.', response.ok ? 502 : response.status); }
    if (!response.ok) {
      const value = data && typeof data === 'object' ? data as Record<string, unknown> : {};
      const fallback = response.status === 409 ? 'Данные изменились. Обновите список класса и проверьте свой выбор.' : response.status === 429 ? 'Слишком много отправок. Подождите и повторите попытку.' : 'Сервер временно недоступен. Повторите попытку.';
      throw new PublicApiError(typeof value.error === 'string' ? value.error : fallback, response.status);
    }
    return data as T;
  }
  async function execute<T>(entry: PendingPublicRequest): Promise<T> {
    if (entry.state !== 'pending') throw new PublicApiError(entry.message || 'Проверьте данные и создайте новую отправку.', 409);
    const existing = inFlight.get(entry.id);
    if (existing) return existing as Promise<T>;
    const promise = (async () => {
      let result: T;
      try { result = await send<T>(entry.path, entry.body); }
      catch (error) {
        if (error instanceof PublicApiError && error.status >= 400 && error.status < 500 && error.status !== 429) {
          await store.put({ ...entry, state: error.status === 409 ? 'conflict' : 'rejected', message: error.message });
          publicQueueChanged();
        }
        throw error;
      }
      // Once confirmed, cleanup failure must not turn server success into an apparent failure.
      await store.remove(entry.id).catch(() => undefined);
      publicQueueChanged();
      return result;
    })();
    inFlight.set(entry.id, promise); publicQueueChanged();
    try { return await promise; } finally { inFlight.delete(entry.id); publicQueueChanged(); }
  }
  async function mutate<T>(path: string, input: Record<string, unknown> | FormData): Promise<T> {
    const body: StoredBody = input instanceof FormData ? { kind: 'form', entries: Array.from(input.entries()) } : { kind: 'json', value: input };
    const hash = await fingerprint(path, body);
    // Serialize preparation to collapse simultaneous taps before the first network call starts.
    const prepare = prepareTail.then(async () => {
      const id = crypto.randomUUID();
      const savedBody: StoredBody = body.kind === 'json' ? {kind: 'json', value: {...body.value, requestKey: id}} : {kind: 'form', entries: [...body.entries.filter(([key]) => key !== 'requestKey'), ['requestKey', id]]};
      const entry: PendingPublicRequest = { id, fingerprint: hash, path, body: savedBody, state: 'pending', createdAt: Date.now() };
      const reserved = await store.reserve(entry); publicQueueChanged(); return reserved;
    });
    prepareTail = prepare.catch(() => undefined);
    let entry: PendingPublicRequest;
    try { entry = await prepare; }
    catch { throw new PublicApiError('Не удалось сохранить отправку на устройстве. Серверу ничего не отправлено. Проверьте свободное место и разрешение на хранение данных.', 0); }
    return execute<T>(entry);
  }
  return { isSending: (id: string) => inFlight.has(id), get: <T>(path: string) => send<T>(path), preview: <T>(path: string, value: Record<string, unknown>) => send<T>(path, {kind: 'json', value}), mutate, retry: <T>(entry: PendingPublicRequest) => execute<T>(entry) };
}
export const crmPublicClient = createCrmPublicClient();
