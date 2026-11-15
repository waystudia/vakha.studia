import { useEffect, useMemo, useState } from 'react';
import { CatalogViewer } from '../components/CatalogViewer';
import { ServiceCard } from '../components/ServiceCard';
import { Loader, Notice } from '../components/ui';
import { buildCatalogSections, type CatalogGender } from '../lib/catalogSections';
import { humanError } from '../lib/helpers';
import type { PublicClassPayload } from '../lib/types';
type Item = PublicClassPayload['catalog'][number];
export function CrmCatalogPage() {
  const [items, setItems] = useState<Item[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [gender, setGender] = useState<CatalogGender>('all'); const [preview, setPreview] = useState<string>();
  useEffect(() => { let alive = true; void fetch(`${import.meta.env.BASE_URL}catalog-snapshot/catalog.json`, {cache:'no-cache'}).then(async response => { if (!response.ok) throw new Error('Каталог временно недоступен. Повторите загрузку.'); return response.json(); }).then(data => { if (alive) setItems(data.catalog); }).catch(reason => { if (alive) setError(humanError(reason)); }).finally(() => { if (alive) setLoading(false); }); return () => { alive = false; }; }, []);
  const sections = useMemo(() => buildCatalogSections(items, gender), [items, gender]);
  return <main className="public-page"><div className="public-shell"><header className="public-header"><div className="public-logo"><span className="brand-mark">KZ</span><div><strong>Khan Zama</strong><small>Школьная фотография</small></div></div></header><section className="public-content"><h1>Каталог фотографий и видео</h1><p className="public-lead">Посмотрите образы и примеры наших работ.</p><Notice kind="info">Чтобы выбрать ребёнка и оформить заявку, откройте ссылку вашего класса от учителя или фотографа.</Notice>
    {loading && <Loader label="Загружаем каталог…"/>}{error && <><Notice kind="error">{error}</Notice><button className="button button-secondary" onClick={() => window.location.reload()}>Повторить загрузку</button></>}
    {!loading && !error && <><div className="inline-actions" role="group" aria-label="Для кого">{([['all','Все'],['boys','Мальчики'],['girls','Девочки']] as const).map(([value,label]) => <button key={value} type="button" className={`button ${gender===value?'button-primary':'button-secondary'}`} aria-pressed={gender===value} onClick={() => setGender(value)}>{label}</button>)}</div>{sections.map(section => <section className="public-catalog-section" key={section.id}><h2>{section.title}</h2><div className="public-catalog-grid">{section.items.map(item => <ServiceCard key={item.id} item={item} readOnly selected={false} onOpen={() => setPreview(item.id)} onToggle={() => {}}/>)}</div></section>)}</>}
  </section>{preview && <CatalogViewer items={items} initialGender={gender} initialCategory="all" initialId={preview} selected={[]} onClose={() => setPreview(undefined)} onToggle={() => {}} readOnly/>}</div></main>;
}
