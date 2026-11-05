import { ShoppingBag, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { OfflineCatalogControls } from "../components/OfflineCatalogControls";
import { loadSavedCatalog } from "../lib/offlineCatalog";
import { ServiceCard } from "../components/ServiceCard";
import { CatalogViewer } from "../components/CatalogViewer";
import { Loader, Modal, Notice } from "../components/ui";
import { buildCatalogSections, type CatalogGender } from "../lib/catalogSections";
import { humanError, money } from "../lib/helpers";
import { getPublicCatalog } from "../lib/repository";
import type { PublicCatalogPayload } from "../lib/types";

type CatalogItem = PublicCatalogPayload["catalog"][number];

const CATEGORY_ORDER = ["Детские образы", "ИИ-видео", "Фото с видео"];

function catalogCategories(items: CatalogItem[]) {
  return [...new Set(items.map((item) => item.category.trim()).filter(Boolean))].sort((left, right) => {
    const leftIndex = CATEGORY_ORDER.indexOf(left);
    const rightIndex = CATEGORY_ORDER.indexOf(right);
    const leftRank = leftIndex === -1 ? CATEGORY_ORDER.length : leftIndex;
    const rightRank = rightIndex === -1 ? CATEGORY_ORDER.length : rightIndex;
    return leftRank - rightRank || left.localeCompare(right, "ru-RU");
  });
}

export function PublicCatalogPage() {
  const { token = "" } = useParams();
  const [params] = useSearchParams();
  const [online, setOnline] = useState(navigator.onLine);
  const [localCopy, setLocalCopy] = useState(false);
  const readOnly = params.get("offline") === "1" || !online || localCopy;
  const [data, setData] = useState<PublicCatalogPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<CatalogItem | null>(null);
  const [gender, setGender] = useState<CatalogGender>("all");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

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
  useEffect(() => { document.body.style.overflow = checkoutOpen && !readOnly ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [checkoutOpen, readOnly]);

  const categories = useMemo(() => catalogCategories(data?.catalog || []), [data]);
  const filteredCatalog = useMemo(() => (data?.catalog || []).filter((item) => category === "all" || item.category === category), [data, category]);
  const sections = useMemo(() => buildCatalogSections(filteredCatalog, gender), [filteredCatalog, gender]);
  const selectedItems = useMemo(() => data?.catalog.filter((item) => selected.includes(item.id)) || [], [data, selected]);
  const total = useMemo(() => selectedItems.reduce((sum, item) => sum + Number(item.price), 0), [selectedItems]);
  useEffect(() => { if (category !== "all" && !categories.includes(category)) setCategory("all"); }, [categories, category]);
  if (loading) return <main className="public-page"><Loader label="Открываем каталог…" /></main>;
  if (error || !data) return <main className="public-page"><section className="public-error"><div className="error-illustration">!</div><h1>Каталог недоступен</h1><p>{error || "Ссылка недействительна"}</p><Link to="/offline-catalog">Сохранённые каталоги</Link></section></main>;

  const watermark = data.watermark;
  const toggle = (id: string) => setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  const renderCard = (item: CatalogItem, related = false) => <ServiceCard key={item.id} item={item} selected={selected.includes(item.id)} related={related} readOnly={readOnly} watermark={watermark} onOpen={() => setPreview(item)} onToggle={() => toggle(item.id)} />;
  const renderSection = (section: typeof sections[number]) => <section className="catalog-section" key={section.id}><h2>{section.title}</h2>{section.notice && <div className="catalog-video-notice"><Video size={20} /><span>{section.notice}</span></div>}{section.items.length > 0 && <div className="public-catalog-grid">{section.items.map((item) => renderCard(item))}</div>}{section.relatedItems?.length ? <><h3 className="catalog-related-title">{section.relatedTitle}</h3><div className="public-catalog-grid">{section.relatedItems.map((item) => renderCard(item, true))}</div></> : null}</section>;
  const mainSections = gender === "all" ? sections.filter((section) => !section.id.startsWith("visual-")) : sections;
  const genderSections = gender === "all" ? sections.filter((section) => section.id.startsWith("visual-")) : [];
  const whatsappPhone = (data.whatsapp?.phone || "").replace(/\D/g, "");
  const whatsappMessage = `Здравствуйте! Хочу оформить заказ в ${data.whatsapp?.company || data.company_name || "Vakha Studio"}.\n\nУслуги:\n${selectedItems.map((item) => `• ${item.name} — ${money(item.price)}`).join("\n")}\n\nИтого: ${money(total)}.`;
  const whatsappUrl = whatsappPhone ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(whatsappMessage)}` : "";

  return <main className="public-page"><div className="public-shell public-catalog-shell">
    <header className="public-header"><div className="public-logo"><span className="brand-mark">VS</span><div><strong>{data.company_name || "Vakha Studio"}</strong><small>Каталог услуг</small></div></div><span className="step-indicator">{readOnly ? "Просмотр каталога" : "Для заказа"}</span></header>
    <section className="public-content public-catalog-content"><span className="eyebrow">Vakha Studio · услуги</span><h1>Каталог</h1><p className="public-lead">{readOnly ? "Каталог для показа" : "Выберите подходящий формат съёмки"}</p>
      {readOnly && <div className="offline-view-notice"><span>{!online ? "Без интернета · только просмотр" : localCopy ? "Сохранённый каталог · только просмотр" : "Только просмотр"}</span><Link to="/offline-catalog">Сохранённые каталоги</Link></div>}
      {readOnly && localCopy ? <details className="offline-manage"><summary>Управление сохранённой копией</summary><OfflineCatalogControls token={token} data={data} online={online} onUpdated={latest => { setData(latest); if (params.get("offline") === "1") setLocalCopy(true); }} /></details> : <OfflineCatalogControls token={token} data={data} online={online} onUpdated={latest => { setData(latest); if (params.get("offline") === "1") setLocalCopy(true); }} />}
      {data.catalog.length > 0 && <><div className="catalog-filter-groups"><div className="catalog-gender-tabs" role="group" aria-label="Для кого услуга"><button type="button" aria-pressed={gender === "all"} className={gender === "all" ? "active" : ""} onClick={() => setGender("all")}>Все</button><button type="button" aria-pressed={gender === "boys"} className={gender === "boys" ? "active" : ""} onClick={() => setGender("boys")}>Мальчикам</button><button type="button" aria-pressed={gender === "girls"} className={gender === "girls" ? "active" : ""} onClick={() => setGender("girls")}>Девочкам</button></div><div className="catalog-category-tabs" role="group" aria-label="Категория услуги"><button type="button" aria-pressed={category === "all"} className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>Все категории</button>{categories.map((itemCategory) => <button type="button" aria-pressed={category === itemCategory} className={category === itemCategory ? "active" : ""} key={itemCategory} onClick={() => setCategory(itemCategory)}>{itemCategory}</button>)}</div></div><div className="catalog-section-list">{mainSections.map(renderSection)}{genderSections.length > 0 && <div className="catalog-gender-columns">{genderSections.map((section) => <section className="catalog-section catalog-gender-column" key={section.id}><h2>{section.title}</h2><div className="public-catalog-grid">{section.items.map((item) => renderCard(item))}</div></section>)}</div>}</div></>}
      {!data.catalog.length && <Notice kind="info">Каталог пока пуст.</Notice>}
    </section>
    {!readOnly && selected.length > 0 && <div className="order-dock catalog-order-dock"><div><span>Выбрано: {selected.length}</span><strong>Итого: {money(total)}</strong></div><button className="button button-primary" onClick={() => setCheckoutOpen(true)}><ShoppingBag size={18} />Оформить заказ</button></div>}
    {preview && <CatalogViewer immersive readOnly={readOnly} items={data.catalog} initialId={preview.id} initialGender={gender} initialCategory={category} selected={selected} onToggle={toggle} onClose={() => setPreview(null)} />}
    {!readOnly && checkoutOpen && <Modal title="Оформить заказ" onClose={() => setCheckoutOpen(false)}><div className="catalog-checkout"><p>Вы отправите менеджеру список выбранных услуг и итоговую сумму.</p><div className="catalog-checkout-items">{selectedItems.map((item) => <div key={item.id}><span>{item.name}</span><strong>{money(item.price)}</strong></div>)}</div><div className="catalog-checkout-total"><span>Итого</span><strong>{money(total)}</strong></div>{whatsappUrl ? <a className="button button-primary button-wide" href={whatsappUrl} target="_blank" rel="noreferrer"><ShoppingBag size={18} />Перейти в WhatsApp</a> : <Notice kind="info">Менеджер ещё не подключил WhatsApp для приёма заказов.</Notice>}</div></Modal>}
  </div></main>;
}
