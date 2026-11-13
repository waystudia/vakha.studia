import { useEffect, useState } from 'react';
import { crmPublicClient } from '../lib/crmPublicClient';
import { publicQueueChanged, publicQueueStore, requestBelongsToClass, type PendingPublicRequest } from '../lib/crmPublicQueue';
import { humanError } from '../lib/helpers';
export function PublicPendingRequests({token, onRefresh}: {token: string; onRefresh: () => Promise<void>}) {
  const [entries, setEntries] = useState<PendingPublicRequest[]>([]);
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(''); const [message, setMessage] = useState('');
  useEffect(() => {
    let alive = true;
    async function update() {
      setOnline(navigator.onLine);
      try { const list = await publicQueueStore.all(); if (alive) setEntries(list.filter(item => requestBelongsToClass(item, token)).sort((a, b) => a.createdAt - b.createdAt)); }
      catch { /* A blocked store is reported by the attempted mutation. */ }
    }
    void update();
    window.addEventListener('online', update); window.addEventListener('offline', update); window.addEventListener('vakha-public-queue', update);
    return () => { alive = false; window.removeEventListener('online', update); window.removeEventListener('offline', update); window.removeEventListener('vakha-public-queue', update); };
  }, [token]);
  async function retry(entry: PendingPublicRequest) {
    setPending(entry.id); setMessage('');
    try {
      await crmPublicClient.retry(entry);
      setMessage('Отправка принята сервером.');
      try { await onRefresh(); } catch { setMessage('Отправка принята. Не удалось обновить список — повторите обновление.'); }
    } catch (error) { setMessage(humanError(error)); }
    finally { setPending(''); }
  }
  async function remove(entry: PendingPublicRequest) {
    setPending(entry.id);
    try { await publicQueueStore.remove(entry.id); publicQueueChanged(); setMessage('Убрано только с этого устройства. Принятые сервером заявки сохранены.'); }
    catch (error) { setMessage(humanError(error)); }
    finally { setPending(''); }
  }
  if (online && !entries.length && !message) return null;
  return <section className="public-content public-child-registration" aria-label="Состояние отправок">
    {!online && <p role="status">Нет интернета. Незавершённые отправки сохраняются на этом устройстве. Для повтора откройте эту ссылку после подключения.</p>}
    {entries.length > 0 && <><h2>Незавершённые отправки: {entries.length}</h2><p>Повторите вручную. Закрытый сайт ничего не отправляет в фоне. Вложения хранятся на этом устройстве до успешной отправки или удаления из очереди.</p></>}
    {entries.map(entry => <div key={entry.id} className="registration-matches">
      <p>{entry.path.endsWith('/children') ? 'Добавление ребёнка' : entry.path.endsWith('/service-video') ? 'Видео к услуге' : entry.path.endsWith('/custom-request') ? 'Индивидуальный запрос' : entry.path.endsWith('/cancel') ? 'Отмена заявки' : 'Выбор услуг'} · {entry.state === 'pending' ? 'ожидает ответа сервера' : entry.state === 'conflict' ? 'данные изменились' : 'нужно исправить данные'}</p>
      {entry.message && <p>{entry.message}</p>}
      <div className="registration-actions">{entry.state === 'pending' && <button className="button button-secondary" type="button" disabled={!online || Boolean(pending) || crmPublicClient.isSending(entry.id)} onClick={() => void retry(entry)}>{pending === entry.id || crmPublicClient.isSending(entry.id) ? 'Отправляем…' : 'Повторить отправку'}</button>}
      {entry.state !== 'pending' && <button className="button button-secondary" type="button" disabled={!online || Boolean(pending)} onClick={() => { void onRefresh().then(() => setMessage('Список обновлён. Уберите прежнюю отправку из очереди, затем откройте ребёнка и проверьте выбор.')).catch(error => setMessage(humanError(error))); }}>Обновить данные класса</button>}
      <button className="button button-ghost" type="button" disabled={Boolean(pending) || crmPublicClient.isSending(entry.id)} onClick={() => void remove(entry)}>Убрать из очереди</button></div>
    </div>)}
    {message && <p role="status">{message}</p>}
  </section>;
}
