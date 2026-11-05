import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { savedCatalogs, offlineCatalogLink, catalogTokenFromLink, type SavedCatalog } from '../lib/offlineCatalog';
import { InstallCatalog } from '../components/OfflineCatalogControls';

export function OfflineCatalogPage() {
  const [saved, setSaved] = useState<SavedCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  const navigate = useNavigate();
  useEffect(() => { void savedCatalogs().then(setSaved).catch(() => setError('Не удалось прочитать память устройства. Откройте каталог в обычной вкладке Safari или Chrome.')).finally(() => setLoading(false)); }, []);
  return <main className="public-page"><div className="public-shell offline-library"><h1>Каталог офлайн</h1><p>Фото, видео и полноэкранный показ. Без входа в аккаунт и оформления заказов.</p>
    {loading ? <p role="status">Проверяем сохранённые каталоги…</p> : <div className="offline-library-list">{saved.map(item => <article className="offline-library-entry" key={item.token}><h2>{item.data.company_name || 'Vakha Studio'}</h2><p>{item.data.catalog.length} услуг · {(item.bytes / 1048576).toFixed(1)} МБ · сохранено {new Date(item.savedAt).toLocaleDateString('ru-RU')}</p><Link className="button button-primary" to={offlineCatalogLink(item.token).replace(import.meta.env.BASE_URL, '/')}>Смотреть каталог</Link></article>)}</div>}
    {!loading && !saved.length && <p>На этом устройстве пока нет сохранённого каталога. Откройте общую ссылку каталога при подключённом интернете и нажмите «Сохранить для офлайн-показа».</p>}
    <form className="offline-add-catalog" onSubmit={event => {
      event.preventDefault();
      const token = catalogTokenFromLink(link);
      if (!token) { setError('Нужна общая ссылка каталога с /catalog/, а не ссылка класса.'); return; }
      if (!navigator.onLine) { setError('Для добавления нового каталога подключитесь к интернету.'); return; }
      navigate(offlineCatalogLink(token).replace(import.meta.env.BASE_URL, '/'));
    }}><label htmlFor="offline-catalog-link">Добавить каталог по общей ссылке</label><input id="offline-catalog-link" type="url" required placeholder="https://…/catalog/…" value={link} onChange={event => { setLink(event.target.value); setError(''); }} /><button type="submit" className="button button-secondary">Открыть и сохранить</button><small>Если после установки список пуст, вставьте сюда общую ссылку и сохраните фото и видео внутри приложения.</small></form>
    {error && <p role="alert">{error}</p>}<InstallCatalog /><p>Если устройство очистило данные браузера, сохраните каталог снова при подключении к интернету.</p>
  </div></main>;
}
