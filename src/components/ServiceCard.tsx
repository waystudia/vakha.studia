import { Check, Image as ImageIcon, Play, Plus, Sparkles } from "lucide-react";
import { money } from "../lib/helpers";
import type { PublicClassPayload } from "../lib/types";

type ServiceCardItem = PublicClassPayload["catalog"][number];
type Watermark = { text: string; image?: string; opacity: number };

type DeliveryFeature = { label: string; tone: "photo" | "print" | "lamination" | "qr" | "video" };

function deliveryFeatures(item: ServiceCardItem): DeliveryFeature[] {
  if (!item.preview_url) return [{ label: "Цифровой результат", tone: "photo" }];
  const features: DeliveryFeature[] = [
    { label: "Фотомонтаж", tone: "photo" },
    { label: "Распечатка A4", tone: "print" },
    { label: "Ламинация", tone: "lamination" },
  ];
  if (item.preview_video_url) {
    features.push({ label: "QR-оживление", tone: "qr" });
    features.push({ label: item.category === "Фото с видео" ? "Интервью ребёнка" : "Персональное ИИ-видео", tone: "video" });
  }
  return features;
}

function DeliveryFeatures({ item }: { item: ServiceCardItem }) {
  return <div className="delivery-feature-list" aria-label="Что получат родители">{deliveryFeatures(item).map((feature) => <span className={`delivery-feature delivery-feature-${feature.tone}`} key={feature.label}>{feature.label}</span>)}</div>;
}

function AiVideoOption({ item }: { item: ServiceCardItem }) {
  if (item.preview_video_url || !item.preview_url || item.category !== "Детские образы") return null;
  return <div className="public-catalog-ai-option"><Sparkles size={14} aria-hidden="true" /><span><strong>Можно оживить фото</strong><br />Нейросетевое видео</span></div>;
}

function CatalogVideoPhone({ item, onOpen }: { item: ServiceCardItem; onOpen: () => void }) {
  if (!item.preview_url || !item.preview_video_url) return null;

  return <button
    type="button"
    className="public-catalog-video-phone"
    aria-label={`Смотреть видео услуги ${item.name}`}
    onClick={(event) => { event.stopPropagation(); onOpen(); }}
  >
    <img src={item.preview_url} alt="" loading="lazy" decoding="async" />
    <span className="public-catalog-video-play"><Play size={12} fill="currentColor" /></span>
  </button>;
}


export function ServiceCard({ item, selected, related = false, readOnly = false, watermark = { text: "Vakha Studio", opacity: .28 }, onOpen, onToggle }: {
  item: ServiceCardItem; selected: boolean; related?: boolean; readOnly?: boolean; watermark?: Watermark;
  onOpen: () => void; onToggle: () => void;
}) {
  return <article className={`public-catalog-card ${selected ? "selected" : ""} ${related ? "catalog-related-card" : ""}`}
    role="button" tabIndex={0} aria-label={`Смотреть услугу: ${item.name}`}
    onKeyDown={event => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onOpen(); } }} onClick={onOpen}>
    <div className="public-catalog-image">
      {item.preview_url ? <img src={item.preview_url} alt="" loading="lazy" decoding="async" /> : <ImageIcon size={40} />}
      <CatalogVideoPhone item={item} onOpen={onOpen} />
      <div className="public-watermark">{watermark.image && <img src={watermark.image} alt="" style={{ opacity: watermark.opacity }} />}{watermark.text && <span style={{ opacity: watermark.opacity }}>{watermark.text}</span>}</div>
      {!related && !readOnly && <button className="public-catalog-add" type="button" aria-pressed={selected} aria-label={selected ? `Убрать ${item.name} из заказа` : `Добавить ${item.name} в заказ`}
        onClick={event => { event.stopPropagation(); onToggle(); }}>{selected ? <Check size={18} /> : <Plus size={19} />}</button>}
    </div>
    <div className="public-catalog-copy"><div className="public-catalog-title"><strong title={item.name}>{item.name}</strong><b>{money(item.price)}</b></div><DeliveryFeatures item={item} /><AiVideoOption item={item} />{related && <small>Доступно для другой категории</small>}</div>
  </article>;
}
