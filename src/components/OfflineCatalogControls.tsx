import { useEffect, useRef, useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getPublicCatalog } from '../lib/repository';
import type { PublicCatalogPayload } from '../lib/types';
import { catalogAssets, loadSavedCatalog, offlineCatalogLink, saveCatalog, type SavedCatalog, type SaveProgress } from '../lib/offlineCatalog';
import './offline-catalog.css';

type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
export function InstallCatalog() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [help, setHelp] = useState(false);
  useEffect(() => {
    const capture = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    const installed = () => { setPrompt(null); setHelp(false); };
    window.addEventListener('beforeinstallprompt', capture); window.addEventListener('appinstalled', installed);
    return () => { window.removeEventListener('beforeinstallprompt', capture); window.removeEventListener('appinstalled', installed); };
  }, []);
  return <div className="catalog-install"><button type="button" className="button button-secondary" onClick={async () => {
    if (prompt) { await prompt.prompt(); await prompt.userChoice; setPrompt(null); }
    else setHelp(value => !value);
  }}><Smartphone size={17} />Установить на устройство</button>{help && <div className="catalog-install-help"><p><strong>iPhone / iPad:</strong> откройте эту страницу в Safari → «Поделиться» → «На экран Домой» → «Добавить».</p><p><strong>Android / планшет:</strong> откройте меню Chrome → «Установить приложение» или «Добавить на главный экран».</p><p>После установки откройте приложение с иконки. Если список пуст, вставьте общую ссылку каталога и сохраните его внутри приложения.</p><p>Перед показом без интернета дождитесь статуса «Сохранено для офлайн-просмотра» на этом устройстве.</p></div>}</div>;
}

export function OfflineCatalogControls({ token, data, online, onUpdated }: { token: string; data: PublicCatalogPayload; online: boolean; onUpdated?: (data: PublicCatalogPayload) => void }) {
  const [saved, setSaved] = useState<SavedCatalog | null>(null);
  const [progress, setProgress] = useState<SaveProgress | null>(null);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => { let alive = true; void loadSavedCatalog(token).then(value => { if (alive) setSaved(value); }).catch(() => {}); return () => { alive = false; controller.current?.abort(); }; }, [token]);
  async function download() {
    if (controller.current) return;
    setError(''); setProgress({ done: 0, total: catalogAssets(data).length, bytes: 0 });
    const task = new AbortController(); controller.current = task;
    try {
      const latest = await getPublicCatalog(token);
      if (!latest) throw new Error('Ссылка на каталог недействительна. Сохранённая версия осталась на устройстве.');
      task.signal.throwIfAborted();
      setSaved(await saveCatalog(token, latest, setProgress, task.signal));
      onUpdated?.(latest);
    }
    catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Не удалось сохранить каталог. Повторите попытку.';
      setError(task.signal.aborted ? 'Сохранение отменено. Предыдущая сохранённая версия осталась доступна.' : /fetch|network|timeout/i.test(message) ? 'Не удалось загрузить текущий каталог. Проверьте интернет и повторите. Предыдущая копия сохранена.' : message);
    }
    finally { controller.current = null; setProgress(null); }
  }
  return <section className="offline-catalog-tools" aria-label="Каталог на устройстве"><div><h2>Каталог с собой</h2><p>Сохраните все фото и видео для показа без интернета.</p></div>
    {progress ? <div className="offline-download" role="status"><progress max={Math.max(progress.total, 1)} value={progress.done} /><span>Сохраняем {progress.done} из {progress.total} · {(progress.bytes / 1048576).toFixed(1)} МБ</span><button type="button" className="button button-secondary" onClick={() => controller.current?.abort()}><X size={16} />Отменить</button><small>Держите вкладку открытой до завершения загрузки.</small></div>
      : <button className="button button-secondary" type="button" disabled={!online} onClick={() => void download()}><Download size={17} />{saved ? 'Обновить офлайн-каталог' : 'Сохранить для офлайн-показа'}</button>}
    {saved && <div className="offline-saved" role="status"><strong>Сохранено для офлайн-просмотра</strong><span>{saved.data.catalog.length} услуг · {saved.files} файлов · {(saved.bytes / 1048576).toFixed(1)} МБ · {new Date(saved.savedAt).toLocaleDateString('ru-RU')}</span><Link to={offlineCatalogLink(token).replace(import.meta.env.BASE_URL, '/')}>Открыть только для просмотра</Link></div>}
    {!online && <p>Для сохранения или обновления подключитесь к интернету.</p>}
    {error && <p className="offline-catalog-error" role="alert">{error}</p>}
    <InstallCatalog /><Link className="offline-library-link" to="/offline-catalog">Сохранённые каталоги</Link>
  </section>;
}
