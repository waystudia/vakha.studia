import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { createCrmPublicClient, PublicApiError } from './crmPublicClient';
import type { PendingPublicRequest, PublicQueueStore } from './crmPublicQueue';
function memoryStore() {
  const values = new Map<string, PendingPublicRequest>();
  const store: PublicQueueStore = { all: async () => [...values.values()], reserve: async row => {const saved=[...values.values()].find(item=>item.fingerprint===row.fingerprint);if(saved)return saved;values.set(row.id,row);return row;}, put: async row => { values.set(row.id, row); }, remove: async id => { values.delete(id); } };
  return {values, store};
}
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), {status, headers: {'Content-Type': 'application/json'}}); }
beforeEach(() => { vi.stubGlobal('crypto', webcrypto); vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('CRM public durable request protocol', () => {
  it('retains the full draft offline, then reuses its key after client recreation', async () => {
    const {store, values} = memoryStore(); const transport = vi.fn<typeof fetch>(async () => json({duplicate:true}));
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const first = createCrmPublicClient(store, transport);
    await expect(first.mutate('classes/token', {childId:'child', itemIds:['photo'], revision:0, itemPreferences:{photo:{comment:'С мячом'}}})).rejects.toThrow('Нет интернета');
    expect(transport).not.toHaveBeenCalled();
    const pending = [...values.values()][0];
    expect(pending.body).toMatchObject({kind:'json',value:{requestKey:pending.id,itemPreferences:{photo:{comment:'С мячом'}}}});
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    await createCrmPublicClient(store, transport).mutate('classes/token', {childId:'child', itemIds:['photo'], revision:0, itemPreferences:{photo:{comment:'С мячом'}},requestKey:'another-ui-key'});
    expect(JSON.parse(String(transport.mock.calls[0][1]?.body)).requestKey).toBe(pending.id);
    expect(transport.mock.calls[0][1]?.credentials).toBe('omit');
    expect(values.size).toBe(0);
  });
  it('uses a different identity for a changed comment, rather than silently replaying old preferences', async () => {
    const {store, values} = memoryStore(); const transport = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('lost response'));
    const client = createCrmPublicClient(store, transport);
    await expect(client.mutate('classes/token', {itemIds:['photo'], itemPreferences:{photo:{comment:'Первый'}}})).rejects.toThrow();
    await expect(client.mutate('classes/token', {itemIds:['photo'], itemPreferences:{photo:{comment:'Другой'}}})).rejects.toThrow();
    expect(values.size).toBe(2);
    const keys = transport.mock.calls.map(([, options]) => JSON.parse(String(options?.body)).requestKey);
    expect(keys[0]).not.toBe(keys[1]);
  });
  it('collapses simultaneous retries of the exact draft', async () => {
    const {store} = memoryStore(); let finish!: () => void;
    const transport = vi.fn<typeof fetch>(async () => { await new Promise<void>(resolve => { finish = resolve; }); return json({ok:true}); });
    const client = createCrmPublicClient(store, transport);
    const one = client.mutate('classes/token/children', {firstName:'Иса',lastName:'Гараев'});
    const two = client.mutate('classes/token/children', {firstName:'Иса',lastName:'Гараев'});
    await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(1)); finish();
    await Promise.all([one,two]); expect(transport).toHaveBeenCalledTimes(1);
  });
  it('keeps a version conflict and never automatically resends it', async () => {
    const {store,values} = memoryStore(); const transport = vi.fn<typeof fetch>(async () => json({error:'Заявка изменена на другом устройстве',code:'version_conflict'},409));
    const client = createCrmPublicClient(store,transport);
    await expect(client.mutate('classes/token',{revision:2})).rejects.toBeInstanceOf(PublicApiError);
    const pending=[...values.values()][0]; expect(pending.state).toBe('conflict');
    await expect(client.retry(pending)).rejects.toThrow('изменена');
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('retains a request when a proxy returns HTML, instead of discarding the draft', async () => {
    const {store,values}=memoryStore(); const transport=vi.fn<typeof fetch>(async()=>new Response('<html>bad gateway</html>',{status:502}));
    await expect(createCrmPublicClient(store,transport).mutate('classes/token',{revision:0})).rejects.toThrow('неполный ответ');
    expect(values.size).toBe(1); expect([...values.values()][0].state).toBe('pending');
  });
  it('never transmits when local persistence fails',async()=>{
    const {store}=memoryStore(); store.reserve=async()=>{throw new Error('quota')}; const transport=vi.fn<typeof fetch>();
    await expect(createCrmPublicClient(store,transport).mutate('classes/token',{})).rejects.toThrow('Серверу ничего не отправлено');
    expect(transport).not.toHaveBeenCalled();
  });
  it('preserves attached bytes and sends multipart without an invented content-type header', async()=>{
    const {store,values}=memoryStore(); const transport=vi.fn<typeof fetch>().mockRejectedValueOnce(new Error('dropped')).mockResolvedValueOnce(json({ok:true}));
    const file=new File(['reference bytes'],'screen.webp',{type:'image/webp'});
    Object.defineProperty(file,'arrayBuffer',{value:async()=>new TextEncoder().encode('reference bytes').buffer});
    const form=new FormData(); form.set('reference',file); form.set('message','Идея'); form.set('revision','1');
    const client=createCrmPublicClient(store,transport);
    await expect(client.mutate('classes/token/children/child/custom-request',form)).rejects.toThrow();
    const pending=[...values.values()][0]; await client.retry(pending);
    const sent=transport.mock.calls[1][1]!; expect(sent.headers).toEqual({});
    expect((sent.body as FormData).get('reference')).toMatchObject({name:'screen.webp',size:15});
    expect((sent.body as FormData).get('requestKey')).toBe(pending.id);
  });
});
