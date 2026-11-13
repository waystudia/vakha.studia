import { useEffect, useState } from 'react';
import { getProfile } from '../lib/repository';
import { PublicCatalogPage } from './PublicCatalogPage';
import { Loader, Notice } from '../components/ui';
import { Link } from 'react-router-dom';
import { humanError } from '../lib/helpers';

export function AdminCatalogViewPage({userId, presentation = false}: {userId: string; presentation?: boolean}) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const publicUrl = new URL(`${import.meta.env.BASE_URL}?/catalog/${encodeURIComponent(token)}`, window.location.origin).toString();
  async function copy() {
    try { await navigator.clipboard.writeText(publicUrl); setCopied(true); }
    catch { setError('Не удалось скопировать. Выделите ссылку ниже и скопируйте вручную.'); }
  }
  async function share() {
    if (!navigator.share) { await copy(); return; }
    try { await navigator.share({title:'Каталог Khan Zama', text:'Выберите понравившиеся фотографии и видео в нашем каталоге', url:publicUrl}); }
    catch (reason) { if (!(reason instanceof DOMException && reason.name === 'AbortError')) setError(humanError(reason)); }
  }
  useEffect(() => { let alive = true; void getProfile(userId).then(profile => { if (alive) setToken(profile.public_catalog_token); }).catch(reason => { if (alive) setError(humanError(reason)); }); return () => { alive = false; }; }, [userId]);
  if (error && !token) return <main className="public-page"><Notice kind="error">{error}</Notice><Link to="/admin/catalog">В админку</Link></main>;
  if (!token) return <Loader label="Открываем каталог…" />;
  if (!presentation) return <main className="public-page"><div className="public-shell"><Link className="back-link" to="/admin/schools">← В админку</Link><section className="section-card"><h1>Поделиться каталогом</h1><p>Общий каталог для школ, детских садов и родителей. Получателям не нужен вход в админку.</p>{error && <Notice kind="error">{error}</Notice>}<label>Ссылка на каталог<input type="url" readOnly value={publicUrl} onFocus={event => event.currentTarget.select()} style={{width:'100%',boxSizing:'border-box'}} /></label><div className="inline-actions" style={{marginTop:16}}><button className="button button-primary" onClick={() => void copy()}>{copied ? 'Ссылка скопирована' : 'Копировать ссылку'}</button><button className="button button-secondary" onClick={() => void share()}>Поделиться</button><a className="button button-secondary" href={publicUrl} target="_blank" rel="noopener noreferrer">Открыть каталог</a></div></section></div></main>;
  return <PublicCatalogPage key={`${token}-${presentation}`} catalogToken={token} presentation internal />;
}
