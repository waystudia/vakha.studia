import { Camera, Image as ImageIcon, Play, UserRound, Video, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { DeliveryPreview } from "../components/DeliveryPreview";
import { Loader, Notice } from "../components/ui";
import { humanError, money } from "../lib/helpers";
import { getPublicCatalog } from "../lib/repository";
import type { PublicCatalogPayload } from "../lib/types";

function ServiceIcon({ type }: { type: string }) { if (type === "video") return <Video/>; if (type === "interview") return <Play/>; if (type === "ai") return <UserRound/>; return <Camera/>; }

export function PublicCatalogPage() {
  const { token = "" } = useParams();
  const [data, setData] = useState<PublicCatalogPayload | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [preview, setPreview] = useState<PublicCatalogPayload["catalog"][number] | null>(null); const [filter, setFilter] = useState("all");
  useEffect(() => { void (async () => { try { const payload = await getPublicCatalog(token); if (!payload) throw new Error("Ссылка на каталог недействительна"); setData(payload); } catch (reason) { setError(humanError(reason)); } finally { setLoading(false); } })(); }, [token]);
  useEffect(() => { document.body.style.overflow = preview ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [preview]);
  const options = useMemo(() => [...new Set((data?.catalog || []).flatMap((item) => [item.gender && item.gender !== "unisex" ? item.gender : "", item.category].filter(Boolean)))], [data]);
  const items = useMemo(() => (data?.catalog || []).filter((item) => filter === "all" || item.gender === filter || item.category === filter), [data, filter]);
  if (loading) return <main className="public-page"><Loader label="Открываем каталог…"/></main>;
  if (error || !data) return <main className="public-page"><section className="public-error"><div className="error-illustration">!</div><h1>Каталог недоступен</h1><p>{error || "Ссылка недействительна"}</p></section></main>;
  const watermark = data.watermark;
  return <main className="public-page"><div className="public-shell public-catalog-shell"><header className="public-header"><div className="public-logo"><span className="brand-mark">VS</span><div><strong>{data.company_name || "Vakha Studio"}</strong><small>Каталог услуг</small></div></div><span className="step-indicator">Для просмотра</span></header><section className="public-content"><span className="eyebrow">Vakha Studio · услуги</span><h1>Каталог</h1><p className="public-lead">Выберите подходящий формат съёмки</p>{options.length > 0 && <div className="catalog-filters"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Все</button>{options.map((option) => <button className={filter === option ? "active" : ""} key={option} onClick={() => setFilter(option)}>{option === "boys" ? "Мальчики" : option === "girls" ? "Девочки" : option}</button>)}</div>}{!items.length && <Notice kind="info">Каталог пока пуст.</Notice>}<div className="public-catalog-grid">{items.map((item) => <article className="public-catalog-card" key={item.id} onClick={() => setPreview(item)}><div className="public-catalog-image">{item.preview_url ? <img src={item.preview_url} alt=""/> : <ImageIcon size={40}/>}<div className="public-watermark">{watermark.image && <img src={watermark.image} alt="" style={{ opacity: watermark.opacity }}/>} {watermark.text && <span style={{ opacity: watermark.opacity }}>{watermark.text}</span>}</div><span className="public-catalog-type">{item.type}</span><button className="public-view-button" onClick={(event) => { event.stopPropagation(); setPreview(item); }}>Смотреть</button></div><div className="public-catalog-copy"><strong>{item.name}</strong><b>{money(item.price)}</b></div></article>)}</div></section>{preview && <div className="modal-backdrop" role="presentation" onClick={() => setPreview(null)}><section className="modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setPreview(null)} aria-label="Закрыть"><X/></button><h2>{preview.name}</h2><DeliveryPreview imageUrl={preview.preview_url} videoUrl={preview.preview_video_url} title={preview.name} mode={preview.parent_preview_mode}/><strong className="public-modal-price">{money(preview.price)}</strong></section></div>}</div></main>;
}
