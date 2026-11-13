import { CatalogInquiry } from "../components/CatalogInquiry";
import { Camera, Maximize, Play, ShoppingBag, UserRound, Video } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { OfflineCatalogControls } from "../components/OfflineCatalogControls";
import { loadSavedCatalog } from "../lib/offlineCatalog";
import { ServiceCard } from "../components/ServiceCard";
import { CatalogViewer, viewerItems } from "../components/CatalogViewer";
import { Loader, Notice } from "../components/ui";
import { buildCatalogSections, type CatalogGender } from "../lib/catalogSections";
import { catalogMediaUrl } from "../lib/mediaUrl";
import { humanError, money } from "../lib/helpers";
import { getPublicCatalog } from "../lib/repository";
import { ParentIntro } from "../components/ParentIntro";
import { hasWatchedParentIntro } from "../lib/parentIntroProgress";
import type { PublicCatalogPayload } from "../lib/types";
import { trackPublicVisit } from "../lib/visitAnalytics";

type CatalogItem = PublicCatalogPayload["catalog"][number];

function ServiceIcon({ type }: { type: string }) {
  if (type === "video") return <Video />;
  if (type === "interview") return <Play />;
  if (type === "ai") return <UserRound />;
  return <Camera />;
}

function serviceCountLabel(count: number) {
  const mod100 = count % 100;
  const mod10 = count % 10;
  const word = mod100 >= 11 && mod100 <= 14 ? "услуг" : mod10 === 1 ? "услуга" : mod10 >= 2 && mod10 <= 4 ? "услуги" : "услуг";
  return `${count} ${word}`;
}

export function PublicCatalogPage({ catalogToken, presentation = false, internal = false }: { catalogToken?: string; presentation?: boolean; internal?: boolean } = {}) {
  const { token: routeToken = "" } = useParams();
  const token = catalogToken || routeToken;
  const [params] = useSearchParams();
  const [online, setOnline] = useState(navigator.onLine);
  const [localCopy, setLocalCopy] = useState(false);
  const immersive = presentation || params.get("offline") === "1";
  const readOnly = immersive;
  const [selected, setSelected] = useState<string[]>([]);
  const [withoutLamination, setWithoutLamination] = useState<string[]>([]);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [data, setData] = useState<PublicCatalogPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<CatalogItem | null>(null);
  const [gender, setGender] = useState<CatalogGender>("all");
  const [activeCategory, setActiveCategory] = useState("");
  const navigationTarget = useRef<{id: string; until: number} | null>(null);
  const [introClosed, setIntroClosed] = useState(hasWatchedParentIntro);

  const toggle = (id: string) => setSelected(old => old.includes(id) ? old.filter(value => value !== id) : [...old, id]);
  const setLamination = (id: string, protectedPhoto: boolean) => setWithoutLamination(old => protectedPhoto ? old.filter(value => value !== id) : old.includes(id) ? old : [...old, id]);

  useEffect(() => { if (!internal && !immersive) trackPublicVisit(token, "catalog"); }, [immersive, internal, token]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError("");
    void (async () => {
      try {
        const saved = await loadSavedCatalog(token).catch(() => null);
        if (saved && (params.get("offline") === "1" || !navigator.onLine)) {
          if (alive) { setData(saved.data); setLocalCopy(true); }
          return;
        }
        try {
          const payload = await getPublicCatalog(token);
          if (!payload) throw new Error("Ссылка на каталог недействительна");
          if (alive) { setData(payload); setLocalCopy(false); }
        } catch (reason) {
          if (saved) { if (alive) { setData(saved.data); setLocalCopy(true); } }
          else throw reason;
        }
      } catch (reason) { if (alive) setError(!navigator.onLine ? "Каталог ещё не сохранён на этом устройстве. Откройте его с интернетом и сохраните для офлайн-показа." : humanError(reason)); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [token, params]);

  const sections = useMemo(() => buildCatalogSections(data?.catalog || [], gender), [data, gender]);
  const prioritizedSections = useMemo(() => sections.map((section) => ({ ...section, items: [...section.items].sort((left, right) => Number(Boolean(right.popular)) - Number(Boolean(left.popular))) })), [sections]);
  const popularItems = useMemo(() => prioritizedSections.flatMap((section) => section.items.find((item) => item.popular) || []), [prioritizedSections]);
  const selectedItems = useMemo(() => (data?.catalog || []).filter(item => selected.includes(item.id)).map(item => ({ ...item, price: Math.max(0, Number(item.price) - (withoutLamination.includes(item.id) ? 50 : 0)) })), [data, selected, withoutLamination]);
  const total = useMemo(() => selectedItems.reduce((sum, item) => sum + Number(item.price), 0), [selectedItems]);
  useEffect(() => {
    if (!sections.length) return;
    if (!sections.some(section => section.id === activeCategory)) setActiveCategory(sections[0].id);
  }, [activeCategory, sections]);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-catalog-section]'));
      const edge = (document.querySelector('.catalog-sticky-filters')?.getBoundingClientRect().height || 90) + 16;
      const target = navigationTarget.current;
      if (target && Date.now() < target.until) {
        const node = nodes.find(node => node.dataset.catalogSection === target.id);
        if (node && Math.abs(node.getBoundingClientRect().top - edge) > 24) return;
      }
      navigationTarget.current = null;
      const current = nodes.filter(node => node.getBoundingClientRect().top <= edge + 24).pop() || nodes[0];
      if (current?.dataset.catalogSection) setActiveCategory(current.dataset.catalogSection);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const cancelNavigation = () => { navigationTarget.current = null; schedule(); };
    window.addEventListener('scroll', schedule, {passive:true});
    window.addEventListener('resize', schedule);
    window.addEventListener('touchstart', cancelNavigation, {passive:true});
    window.addEventListener('wheel', cancelNavigation, {passive:true});
    schedule();
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); window.removeEventListener('touchstart', cancelNavigation); window.removeEventListener('wheel', cancelNavigation); };
  }, [immersive, sections]);
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>('.catalog-jump-nav');
    const button = nav?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!nav || !button) return;
    const left = nav.scrollLeft + button.getBoundingClientRect().left - nav.getBoundingClientRect().left - (nav.clientWidth - button.offsetWidth) / 2;
    if (typeof nav.scrollTo === 'function') nav.scrollTo({left, behavior:'smooth'});
    else nav.scrollLeft = left;
  }, [activeCategory]);

  function scrollToCategory(id: string) {
    navigationTarget.current = {id, until:Date.now() + 1500};
    setActiveCategory(id);
    document.querySelector<HTMLElement>(`[data-catalog-section="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (loading) return <main className="public-page"><Loader label="Открываем каталог…" /></main>;
  if (error || !data) return <main className="public-page"><section className="public-error"><div className="error-illustration">!</div><h1>Каталог недоступен</h1><p>{error || "Ссылка недействительна"}</p><Link to="/offline-catalog">Сохранённые каталоги</Link></section></main>;

  const slideshowStart = viewerItems(data.catalog, gender, "all")[0];
  const renderCard = (item: CatalogItem, related = false) => <ServiceCard key={item.id} item={item} selected={selected.includes(item.id)} related={related} readOnly={readOnly} withLamination={!withoutLamination.includes(item.id)} watermark={data.watermark} onOpen={() => setPreview(item)} onToggle={() => toggle(item.id)} onLaminationChange={related || readOnly ? undefined : value => setLamination(item.id, value)} />;

  return <main className="public-page"><div className="public-shell public-catalog-shell">
    <header className="public-header"><div className="public-logo"><span className="brand-mark">KZ</span><div><strong>{data.company_name || "Khan Zama"}</strong><small>{presentation ? "Каталог для показа" : "Каталог услуг"}</small></div></div>{presentation && internal ? <span className="step-indicator"><Link to="/admin/catalog">В админку</Link></span> : null}</header>
    {!immersive && <ParentIntro watched={introClosed} onComplete={() => setIntroClosed(true)} />}
    <section className="public-content public-catalog-content" id="public-catalog-start"><h1>Каталог услуг</h1><p className="public-lead">Выберите понравившиеся услуги и отправьте заявку в WhatsApp</p>
      {data.catalog.length > 0 && <div className="catalog-sticky-filters"><div className="catalog-gender-tabs" role="group" aria-label="Категория ребёнка"><button className={gender === "all" ? "active" : ""} onClick={() => setGender("all")}>Все</button><button className={gender === "boys" ? "active" : ""} onClick={() => setGender("boys")}>Мальчики</button><button className={gender === "girls" ? "active" : ""} onClick={() => setGender("girls")}>Девочки</button></div><nav className="catalog-jump-nav" aria-label="Быстрый переход по категориям">{prioritizedSections.map(section => <button type="button" key={section.id} className={activeCategory === section.id ? "active" : ""} aria-current={activeCategory === section.id ? "true" : undefined} onClick={() => scrollToCategory(section.id)}>{section.title}</button>)}</nav></div>}
      {immersive && <button type="button" className="button button-primary catalog-slideshow-start" disabled={!slideshowStart} onClick={() => { const item = data.catalog.find(entry => entry.id === slideshowStart?.id); if (item) setPreview(item); }}><Maximize size={20} />Открыть слайд-шоу</button>}
      {immersive && <div className="offline-view-notice"><span>{!online ? "Без интернета · только просмотр" : localCopy ? "Сохранённый каталог · только просмотр" : "Только просмотр"}</span><Link to="/offline-catalog">Сохранённые каталоги</Link></div>}
      {immersive && (readOnly && localCopy ? <details className="offline-manage"><summary>Управление сохранённой копией</summary><OfflineCatalogControls token={token} data={data} online={online} onUpdated={latest => { setData(latest); if (params.get("offline") === "1") setLocalCopy(true); }} /></details> : <OfflineCatalogControls token={token} data={data} online={online} onUpdated={latest => { setData(latest); if (params.get("offline") === "1") setLocalCopy(true); }} />)}
      {!immersive && prioritizedSections.length > 0 && <div className="catalog-category-cards" aria-label="Категории услуг">{prioritizedSections.map((section, index) => {
        const preferredGender = index % 2 === 0 ? "girls" : "boys";
        const dragonVideo = section.id === "video" ? section.items.find(item => /дракон/i.test(item.name) && item.preview_url) : undefined;
        const coverItem = dragonVideo || section.items.find(item => item.gender === preferredGender && item.preview_url) || section.items.find(item => item.preview_url);
        return <button type="button" className="catalog-category-card" key={section.id} aria-label={`Перейти к категории ${section.title}`} onClick={() => scrollToCategory(section.id)}><span className="catalog-category-media">{coverItem?.preview_video_url ? <video src={catalogMediaUrl(coverItem.preview_video_url)} poster={coverItem.preview_url || undefined} aria-label={`Беззвучное видео-превью: ${coverItem.name}`} autoPlay muted loop playsInline preload="metadata" /> : coverItem?.preview_url ? <img src={coverItem.preview_url} alt="" loading="lazy" decoding="async" /> : <ServiceIcon type={section.items[0]?.type || "photo"} />}</span><span className="catalog-category-copy"><strong>{section.title}</strong><small>{serviceCountLabel(section.items.length)}</small></span></button>;
      })}</div>}
      {popularItems.length > 0 && <section className="catalog-popular-section" aria-label="Популярные услуги"><h2>Популярное</h2><p>Лучшие варианты — по одной услуге из каждой категории.</p><div className="service-list">{popularItems.map(item => renderCard(item))}</div></section>}
      {data.catalog.length > 0 && <><div className="catalog-section-list">{prioritizedSections.map(section => <section className="service-group catalog-section" data-catalog-section={section.id} key={section.id}><h2>{section.title}</h2>{section.notice && <div className="catalog-video-notice"><Video size={20}/><span>{section.notice}</span></div>}<div className="service-list">{section.items.map(item => renderCard(item))}</div></section>)}</div></>}
      {!data.catalog.length && <Notice kind="info">Каталог пока пуст.</Notice>}
    </section>
    {!immersive && selected.length > 0 && <aside className="catalog-order-dock" aria-label="Выбранные услуги"><div><strong><ShoppingBag size={17}/> Корзина · {selected.length}</strong><span>Итого: {money(total)}</span></div><button className="button button-primary" type="button" onClick={() => setInquiryOpen(true)}>Оформить заявку</button></aside>}
    {!immersive && <CatalogInquiry token={token} items={selectedItems} whatsapp={data.whatsapp} open={inquiryOpen} onClose={() => setInquiryOpen(false)} />}
    {preview && <CatalogViewer immersive={immersive} readOnly={readOnly} items={data.catalog} initialId={preview.id} initialGender={gender} selected={selected} onToggle={id => { toggle(id); setPreview(null); }} onClose={() => setPreview(null)} />}
  </div></main>;
}
