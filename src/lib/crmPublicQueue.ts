/** Separate from CRM's IndexedDB; never opens, clears or migrates its stores. */
export type StoredBody = { kind: 'json'; value: Record<string, unknown> } | { kind: 'form'; entries: Array<[string, string | File]> };
export interface PendingPublicRequest {
  id: string;
  fingerprint: string;
  path: string;
  body: StoredBody;
  state: 'pending' | 'conflict' | 'rejected';
  message?: string;
  createdAt: number;
}
export interface PublicQueueStore {
  all(): Promise<PendingPublicRequest[]>;
  reserve(value: PendingPublicRequest): Promise<PendingPublicRequest>;
  put(value: PendingPublicRequest): Promise<void>;
  remove(id: string): Promise<void>;
}
const databaseName = 'vakha-parent-public-requests-v1';
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('requests', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Закройте другие вкладки сайта и повторите отправку.'));
  });
}
async function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction('requests', mode);
      const request = run(tx.objectStore('requests'));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error || request.error);
      tx.onerror = () => reject(tx.error || request.error);
    });
  } finally { db.close(); }
}
export const publicQueueStore: PublicQueueStore = {
  all: () => transaction('readonly', store => store.getAll()),
  reserve: async value => {
    const db = await database();
    try {
      return await new Promise<PendingPublicRequest>((resolve, reject) => {
        const tx = db.transaction('requests', 'readwrite');
        const store = tx.objectStore('requests');
        const request = store.getAll();
        let selected = value;
        request.onsuccess = () => {
          const existing = (request.result as PendingPublicRequest[]).find(item => item.fingerprint === value.fingerprint);
          if (existing) selected = existing;
          else store.add(value);
        };
        tx.oncomplete = () => resolve(selected);
        tx.onabort = () => reject(tx.error || request.error);
        tx.onerror = () => reject(tx.error || request.error);
      });
    } finally { db.close(); }
  },
  put: async value => { await transaction('readwrite', store => store.put(value)); },
  remove: async id => { await transaction('readwrite', store => store.delete(id)); },
};
export function publicQueueChanged() { window.dispatchEvent(new Event('vakha-public-queue')); }
export function requestBelongsToClass(request: PendingPublicRequest, token: string) {
  const root = `classes/${encodeURIComponent(token)}`;
  return request.path === root || request.path.startsWith(root + '/');
}
