import { Check, Image as ImageIcon, Plus, ShoppingBag, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { DeliveryPreview } from "../components/DeliveryPreview";
import { Loader, Modal, Notice } from "../components/ui";
import { buildCatalogSections, type CatalogGender } from "../lib/catalogSections";
import { humanError, money } from "../lib/helpers";
import { getPublicCatalog } from "../lib/repository";
import type { PublicCatalogPayload } from "../lib/types";

type CatalogItem = PublicCatalogPayload["catalog"][number];

export function PublicCatalogPage() {
  const { token = "" } = useParams();
  const [data, setData] = useState<PublicCatalogPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<CatalogItem | null>(null);
  const [gender, setGender] = useState<CatalogGender>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => { void (async () => { try { const payload = await getPublicCatalog(token); if (!payload) throw new Error("Ссылка на каталог недействительна"); setData(payload); } catch (reason) { setError(humanError(reason)); } finally { setLoading(false); } })(); }, [token]);
  useEffect(() => { document.body.style.overflow = preview || checkoutOpen ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [preview, checkoutOpen]);

  const sections = useMemo(() => buildCatalogSections(data?.catalog || [], gender), [data, gender]);
  const selectedItems = useMemo(() => data?.catalog.filter((item) => selected.includes(item.id)) || [], [data, selected]);
  const total = useMemo(() => selectedItems.reduce((sum, item) => sum + Number(item.price), 0), [selectedItems]);
  if (loading) return <main className="public-page"><Loader label="Открываем каталог…" /></main>;
  if (error || !data) return <main className="public-page"><section className="public-error"><div className="error-illustration">!</div><h1>Каталог недоступен</h1><p>{error || "Ссылка недействительна"}</p></section></main>;

  const watermark = data.watermark;
  const toggle = (id: string) => setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  const renderCard = (item: CatalogItem, related = false) => {
    const active = selected.includes(item.id);
    return <article className={`public-catalog-card ${active ? "selected" : ""} ${related ? "catalog-related-card" : ""}`} key={item.id} onClick={() => setPreview(item)}>
      <div className="public-catalog-image">
        {item.preview_url ? <img src={item.preview_url} alt="" /> : <ImageIcon size={40} />}
        {item.preview_video_url && <span className="public-catalog-video-phone" aria-label={`Видео-превью услуги ${item.name}`}><video muted playsInline autoPlay loop preload="metadata" poster={item.preview_url || undefined} src={item.preview_video_url} /></span>}
        <div className="public-watermark">{watermark.image && <img src={watermark.image} alt="" style={{ opacity: watermark.opacity }} />}{watermark.text && <span style={{ opacity: watermark.opacity }}>{watermark.text}</span>}</div>
        {!related && <button className="public-catalog-add" type="button" aria-label={active ? `Убрать ${item.name} из заказа` : `Добавить ${item.name} в заказ`} onClick={(event) => { event.stopPropagation(); toggle(item.id); }}>{active ? <Check size={18} /> : <Plus size={19} />}</button>}
      </div>
      <div className="public-catalog-copy"><strong title={item.name}>{item.name}</strong><b>{money(item.price)}</b></div>
    </article>;
  };
  const renderSection = (section: typeof sections[number]) => <section className="catalog-section" key={section.id}><h2>{section.title}</h2>{section.notice && <div className="catalog-video-notice"><Video size={20} /><span>{section.notice}</span></div>}{section.items.length > 0 && <div className="public-catalog-grid">{section.items.map((item) => renderCard(item))}</div>}{section.relatedItems?.length ? <><h3 className="catalog-related-title">{section.relatedTitle}</h3><div className="public-catalog-grid">{section.relatedItems.map((item) => renderCard(item, true))}</div></> : null}</section>;
  const mainSections = gender === "all" ? sections.filter((section) => !section.id.startsWith("visual-")) : sections;
  const genderSections = gender === "all" ? sections.filter((section) => section.id.startsWith("visual-")) : [];
  const whatsappPhone = (data.whatsapp?.phone || "").replace(/\D/g, "");
  const whatsappMessage = `Здравствуйте! Хочу оформить заказ в ${data.whatsapp?.company || data.company_name || "Vakha Studio"}.\n\nУслуги:\n${selectedItems.map((item) => `• ${item.name} — ${money(item.price)}`).join("\n")}\n\nИтого: ${money(total)}.`;
  const whatsappUrl = whatsappPhone ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(whatsappMessage)}` : "";

  return <main className="public-page"><div className="public-shell public-catalog-shell">
    <header className="public-header"><div className="public-logo"><span className="brand-mark">VS</span><div><strong>{data.company_name || "Vakha Studio"}</strong><small>Каталог услуг</small></div></div><span className="step-indicator">Для заказа</span></header>
    <section className="public-content public-catalog-content"><span className="eyebrow">Vakha Studio · услуги</span><h1>Каталог</h1><p className="public-lead">Выберите подходящий формат съёмки</p>
      {data.catalog.length > 0 && <><div className="catalog-gender-tabs" role="group" aria-label="Категория ребёнка"><button className={gender === "all" ? "active" : ""} onClick={() => setGender("all")}>Все</button><button className={gender === "boys" ? "active" : ""} onClick={() => setGender("boys")}>Мальчики</button><button className={gender === "girls" ? "active" : ""} onClick={() => setGender("girls")}>Девочки</button></div><div className="catalog-section-list">{mainSections.map(renderSection)}{genderSections.length > 0 && <div className="catalog-gender-columns">{genderSections.map((section) => <section className="catalog-section catalog-gender-column" key={section.id}><h2>{section.title}</h2><div className="public-catalog-grid">{section.items.map((item) => renderCard(item))}</div></section>)}</div>}</div></>}
      {!data.catalog.length && <Notice kind="info">Каталог пока пуст.</Notice>}
    </section>
    {selected.length > 0 && <div className="order-dock catalog-order-dock"><div><span>Выбрано: {selected.length}</span><strong>Итого: {money(total)}</strong></div><button className="button button-primary" onClick={() => setCheckoutOpen(true)}><ShoppingBag size={18} />Оформить заказ</button></div>}
    {preview && <Modal title={preview.name} onClose={() => setPreview(null)}><section className="delivery-preview-copy"><h3>Что получат родители</h3><p>{preview.preview_url ? "Фотомонтаж · распечатка · ламинация" : "Цифровой результат"}{preview.preview_video_url ? " · QR-оживление · персональное видео" : ""}</p></section><DeliveryPreview imageUrl={preview.preview_url} videoUrl={preview.preview_video_url} title={preview.name} mode={preview.parent_preview_mode} /><div className="public-preview-actions"><strong>{money(preview.price)}</strong><button className="button button-primary" onClick={() => toggle(preview.id)}>{selected.includes(preview.id) ? <><Check size={18} />Добавлено</> : <><Plus size={18} />Добавить к заказу</>}</button></div></Modal>}
    {checkoutOpen && <Modal title="Оформить заказ" onClose={() => setCheckoutOpen(false)}><div className="catalog-checkout"><p>Вы отправите менеджеру список выбранных услуг и итоговую сумму.</p><div className="catalog-checkout-items">{selectedItems.map((item) => <div key={item.id}><span>{item.name}</span><strong>{money(item.price)}</strong></div>)}</div><div className="catalog-checkout-total"><span>Итого</span><strong>{money(total)}</strong></div>{whatsappUrl ? <a className="button button-primary button-wide" href={whatsappUrl} target="_blank" rel="noreferrer"><ShoppingBag size={18} />Перейти в WhatsApp</a> : <Notice kind="info">Менеджер ещё не подключил WhatsApp для приёма заказов.</Notice>}</div></Modal>}
  </div></main>;
}
