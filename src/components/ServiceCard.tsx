import { useId, useState } from "react";
import { Check, ChevronDown, Image as ImageIcon, Play, Plus, Printer, QrCode, ShieldCheck, ShieldOff, Sparkles, Video, WandSparkles } from "lucide-react";
import { money } from "../lib/helpers";
import { catalogPreviewUrl } from "../lib/catalogPreview";
import type { PublicClassPayload } from "../lib/types";

type ServiceCardItem = PublicClassPayload["catalog"][number];
type Watermark = { text: string; image?: string; opacity: number };

type DeliveryFeature = { label: string; tone: "photo" | "print" | "lamination" | "qr" | "video" };

function deliveryFeatures(item: ServiceCardItem): DeliveryFeature[] {
  if (!catalogPreviewUrl(item)) return [{ label: "Цифровой результат", tone: "photo" }];
  const features: DeliveryFeature[] = [
    { label: "Фотомонтаж", tone: "photo" },
    { label: "Распечатка A4", tone: "print" },
    { label: "Ламинация", tone: "lamination" },
  ];
  if (item.preview_video_url) {
    features.push({ label: "QR-оживление", tone: "qr" });
  }
  if (item.category === "Фото с видео") {
    features.push({ label: "Интервью ребёнка", tone: "video" });
  } else if (item.preview_video_url) {
    features.push({ label: "Персональное ИИ-видео", tone: "video" });
  }
  return features;
}

function DeliveryFeatureIcon({ tone }: { tone: DeliveryFeature["tone"] }) {
  if (tone === "print") return <Printer aria-hidden="true" />;
  if (tone === "lamination") return <ShieldCheck aria-hidden="true" />;
  if (tone === "qr") return <QrCode aria-hidden="true" />;
  if (tone === "video") return <Video aria-hidden="true" />;
  return <WandSparkles aria-hidden="true" />;
}

function DeliveryFeatures({ item }: { item: ServiceCardItem }) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  return <div className={`delivery-features ${expanded ? "is-expanded" : ""}`} onClick={event => event.stopPropagation()}>
    <button type="button" className="delivery-feature-toggle" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(value => !value)}>
      <span>Что вы получите?</span><ChevronDown aria-hidden="true" />
    </button>
    {expanded && <div className="delivery-feature-list" id={detailsId} aria-label="Что получат родители">{deliveryFeatures(item).map((feature) => <span className={`delivery-feature delivery-feature-${feature.tone}`} key={feature.label}><DeliveryFeatureIcon tone={feature.tone} /><span>{feature.label}</span></span>)}</div>}
  </div>;
}

function AiVideoOption({ item }: { item: ServiceCardItem }) {
  if (item.preview_video_url || !item.preview_url || item.category !== "Детские образы") return null;
  return <div className="public-catalog-ai-option"><Sparkles size={14} aria-hidden="true" /><span><strong>Можно оживить фото</strong><br />Нейросетевое видео</span></div>;
}

function CatalogVideoPhone({ item, onOpen }: { item: ServiceCardItem; onOpen: () => void }) {
  const preview = catalogPreviewUrl(item);
  if (!preview || !item.preview_video_url) return null;

  return <button
    type="button"
    className="public-catalog-video-phone"
    aria-label={`Смотреть видео услуги ${item.name}`}
    onClick={(event) => { event.stopPropagation(); onOpen(); }}
  >
    <img src={preview} alt="" loading="lazy" decoding="async" />
    <span className="public-catalog-video-play"><Play size={12} fill="currentColor" /></span>
  </button>;
}


export function ServiceCard({ item, selected, related = false, readOnly = false, withLamination = true, watermark = { text: "Vakha Studio", opacity: .28 }, onOpen, onToggle, onLaminationChange }: {
  item: ServiceCardItem; selected: boolean; related?: boolean; readOnly?: boolean; watermark?: Watermark;
  withLamination?: boolean; onOpen: () => void; onToggle: () => void; onLaminationChange?: (withLamination: boolean) => void;
}) {
  const selectedPrice = Math.max(0, Number(item.price) - (withLamination ? 0 : 50));
  const preview = catalogPreviewUrl(item);
  const chooseLamination = (value: boolean) => {
    onLaminationChange?.(value);
    if (!selected) onToggle();
  };
  return <article data-service-id={item.id} className={`public-catalog-card ${selected ? "selected" : ""} ${related ? "catalog-related-card" : ""} ${item.category === "Фото с видео" ? "catalog-interview-card" : ""}`}
    role="button" tabIndex={0} aria-label={`Смотреть услугу: ${item.name}`}
    onKeyDown={event => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onOpen(); } }} onClick={onOpen}>
    <div className="public-catalog-image">
      {preview ? <img src={preview} alt="" loading="lazy" decoding="async" /> : <ImageIcon size={40} />}
      <CatalogVideoPhone item={item} onOpen={onOpen} />
      <div className="public-watermark">{watermark.image && <img src={watermark.image} alt="" style={{ opacity: watermark.opacity }} />}{watermark.text && <span style={{ opacity: watermark.opacity }}>{watermark.text}</span>}</div>
      {!related && !readOnly && <button className="public-catalog-add" type="button" aria-pressed={selected} aria-label={selected ? `Убрать ${item.name} из заказа` : `Добавить ${item.name} в заказ`}
        onClick={event => { event.stopPropagation(); onToggle(); }}>{selected ? <Check size={18} /> : <Plus size={19} />}</button>}
    </div>
    <div className="public-catalog-copy"><div className="public-catalog-title"><strong title={item.name}>{item.name}</strong><b>{money(selectedPrice)}</b></div><DeliveryFeatures item={item} />{!related && !readOnly && onLaminationChange && <div className="lamination-choice" role="radiogroup" aria-label={`Защита для услуги «${item.name}»`} onClick={event => event.stopPropagation()}>
      <button type="button" role="radio" aria-label={`С защитой ${money(item.price)}`} aria-checked={withLamination} className={withLamination ? "active" : ""} onClick={() => chooseLamination(true)}><ShieldCheck aria-hidden="true" /><span>Защита</span><strong>{money(item.price)}</strong></button>
      <button type="button" role="radio" aria-label={`Без защиты ${money(Math.max(0, Number(item.price) - 50))}`} aria-checked={!withLamination} className={!withLamination ? "active" : ""} onClick={() => chooseLamination(false)}><ShieldOff aria-hidden="true" /><span>Без защиты</span><strong>{money(Math.max(0, Number(item.price) - 50))}</strong></button>
    </div>}<AiVideoOption item={item} />{related && <small>Доступно для другой категории</small>}</div>
  </article>;
}
