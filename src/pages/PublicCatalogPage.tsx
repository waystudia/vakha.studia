import { CatalogInquiry } from "../components/CatalogInquiry";
import { Video, Maximize, ShoppingBag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { OfflineCatalogControls } from "../components/OfflineCatalogControls";
import { loadSavedCatalog } from "../lib/offlineCatalog";
import { ServiceCard } from "../components/ServiceCard";
import { CatalogViewer, viewerItems } from "../components/CatalogViewer";
import { Loader, Notice } from "../components/ui";
import { buildCatalogSections, type CatalogGender } from "../lib/catalogSections";
import { humanError } from "../lib/helpers";
import { getPublicCatalog } from "../lib/repository";
import type { PublicCatalogPayload } from "../lib/types";

type CatalogItem = PublicCatalogPayload["catalog"][number];

const CATEGORY_ORDER = ["Детские образы", "Игровые фотомонтажи", "ИИ-видео", "Фото с видео"];

function catalogCategories(items: CatalogItem[]) {
  return [...new Set(items.map((item) => item.category.trim()).filter(Boolean))].sort((left, right) => {
    const leftIndex = CATEGORY_ORDER.indexOf(left);
    const rightIndex = CATEGORY_ORDER.indexOf(right);
    const leftRank = leftIndex === -1 ? CATEGORY_ORDER.length : leftIndex;
    const rightRank = rightIndex === -1 ? CATEGORY_ORDER.length : rightIndex;
    return leftRank - rightRank || left.localeCompare(right, "ru-RU");
  });
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
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const toggle = (id: string) => setSelected(old => old.includes(id) ? old.filter(value => value !== id) : [...old, id]);
  const [data, setData] = useState<PublicCatalogPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<CatalogItem | null>(null);
  const [gender, setGender] = useState<CatalogGender>("all");
  const [category, setCategory] = useState("all");


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
  }, [token, params.get("offline")]);


  const categories = useMemo(() => catalogCategories(data?.catalog || []), [data]);
  const filteredCatalog = useMemo(() => (data?.catalog || []).filter((item) => category === "all" || item.category === category), [data, category]);
  const sections = useMemo(() => buildCatalogSections(filteredCatalog, gender), [filteredCatalog, gender]);
  useEffect(() => { if (category !== "all" && !categories.includes(category)) setCategory("all"); }, [categories, category]);
  if (loading) return <main className="public-page"><Loader label="Открываем каталог…" /></main>;
  if (error || !data) return <main className="public-page"><section className="public-error"><div className="error-illustration">!</div><h1>Каталог недоступен</h1><p>{error || "Ссылка недействительна"}</p><Link to="/offline-catalog">Сохранённые каталоги</Link></section></main>;

  const slideshowStart = viewerItems(data.catalog, gender, category)[0];
  const watermark = data.watermark;
  const renderCard = (item: CatalogItem, related = false) => <ServiceCard key={item.id} item={item} selected={selected.includes(item.id)} related={related} readOnly={readOnly} watermark={watermark} onOpen={() => setPreview(item)} onToggle={() => toggle(item.id)} />;
  const renderSection = (section: typeof sections[number]) => <section className="catalog-section" key={section.id}><h2>{section.title}</h2>{section.notice && <div className="catalog-video-notice"><Video size={20} /><span>{section.notice}</span></div>}{section.items.length > 0 && <div className="public-catalog-grid">{section.items.map((item) => renderCard(item))}</div>}{section.relatedItems?.length ? <><h3 className="catalog-related-title">{section.relatedTitle}</h3><div className="public-catalog-grid">{section.relatedItems.map((item) => renderCard(item, true))}</div></> : null}</section>;
  const mainSections = gender === "all" ? sections.filter((section) => !section.id.startsWith("visual-")) : sections;
  const genderSections = gender === "all" ? sections.filter((section) => section.id.startsWith("visual-")) : [];

  return <main className="public-page"><div className="public-shell public-catalog-shell">
    <header className="public-header"><div className="public-logo"><span className="brand-mark">VS</span><div><strong>{data.company_name || "Vakha Studio"}</strong><small>{presentation ? "Каталог для показа" : "Каталог услуг"}</small></div></div><span className="step-indicator">{internal ? <Link to="/admin/catalog">В админку</Link> : "Просмотр каталога"}</span></header>
    <section className="public-content public-catalog-content"><h1>Каталог</h1><p className="public-lead">{presentation ? "Показ фото и видео" : "Посмотрите услуги и примеры съёмки"}</p>
      {!immersive && <section><h2>Знакомство со студией</h2><video controls playsInline preload="metadata" src={`${import.meta.env.BASE_URL}media/khan-zama-intro.mp4`} style={{width:"100%",maxHeight:420}} /></section>}
      {immersive && <button type="button" className="button button-primary catalog-slideshow-start" disabled={!slideshowStart} onClick={() => { const item = data.catalog.find(item => item.id === slideshowStart?.id); if (item) setPreview(item); }}><Maximize size={20} />Открыть слайд-шоу</button>}
      {immersive && <div className="offline-view-notice"><span>{!online ? "Без интернета · только просмотр" : localCopy ? "Сохранённый каталог · только просмотр" : "Только просмотр"}</span><Link to="/offline-catalog">Сохранённые каталоги</Link></div>}
      {immersive && (readOnly && localCopy ? <details className="offline-manage"><summary>Управление сохранённой копией</summary><OfflineCatalogControls token={token} data={data} online={online} onUpdated={latest => { setData(latest); if (params.get("offline") === "1") setLocalCopy(true); }} /></details> : <OfflineCatalogControls token={token} data={data} online={online} onUpdated={latest => { setData(latest); if (params.get("offline") === "1") setLocalCopy(true); }} />)}
      {data.catalog.length > 0 && <><div className="catalog-filter-groups"><div className="catalog-gender-tabs" role="group" aria-label="Для кого услуга"><button type="button" aria-pressed={gender === "all"} className={gender === "all" ? "active" : ""} onClick={() => setGender("all")}>Все</button><button type="button" aria-pressed={gender === "boys"} className={gender === "boys" ? "active" : ""} onClick={() => setGender("boys")}>Мальчикам</button><button type="button" aria-pressed={gender === "girls"} className={gender === "girls" ? "active" : ""} onClick={() => setGender("girls")}>Девочкам</button></div><div className="catalog-category-tabs" role="group" aria-label="Категория услуги"><button type="button" aria-pressed={category === "all"} className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>Все категории</button>{categories.map((itemCategory) => <button type="button" aria-pressed={category === itemCategory} className={category === itemCategory ? "active" : ""} key={itemCategory} onClick={() => setCategory(itemCategory)}>{itemCategory}</button>)}</div></div><div className="catalog-section-list">{mainSections.map(renderSection)}{genderSections.length > 0 && <div className="catalog-gender-columns">{genderSections.map((section) => <section className="catalog-section catalog-gender-column" key={section.id}><h2>{section.title}</h2><div className="public-catalog-grid">{section.items.map((item) => renderCard(item))}</div></section>)}</div>}</div></>}
      {!data.catalog.length && <Notice kind="info">Каталог пока пуст.</Notice>}
    </section>
    {!immersive && selected.length > 0 && <aside className="catalog-order-dock" aria-label="Выбранные услуги"><div><strong>Выбрано: {selected.length}</strong><span>Оформите заявку для школы или садика</span></div><button className="button button-primary" type="button" onClick={()=>setInquiryOpen(true)}><ShoppingBag size={18}/>Оформить заявку</button></aside>}
    {!immersive && <CatalogInquiry token={token} selected={selected} open={inquiryOpen} onClose={()=>setInquiryOpen(false)} />}
    {preview && <CatalogViewer immersive={immersive} readOnly={readOnly} items={data.catalog} initialId={preview.id} initialGender={gender} initialCategory={category} selected={selected} onToggle={id => { toggle(id); setPreview(null); }} onClose={() => setPreview(null)} />}

  </div></main>;
}
