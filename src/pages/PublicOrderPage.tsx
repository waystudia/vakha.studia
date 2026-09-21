import { ArrowLeft, Camera, Check, CheckCircle2, LoaderCircle, Play, Plus, UserRound, Video } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useParams } from "react-router-dom";
import { Loader, Modal, Notice } from "../components/ui";
import { DeliveryPreview } from "../components/DeliveryPreview";
import { humanError, money } from "../lib/helpers";
import { getPublicClass, submitPublicOrder } from "../lib/repository";
import type { PublicClassPayload, PublicOrderResult } from "../lib/types";

type Step = "child" | "services" | "done";
type CatalogEntry = PublicClassPayload["catalog"][number];

function ServiceIcon({ type }: { type: string }) {
  if (type === "video") return <Video />;
  if (type === "interview") return <Play />;
  if (type === "ai") return <UserRound />;
  return <Camera />;
}

function genderLabel(gender: string) {
  if (gender === "boys") return "Мальчики";
  if (gender === "girls") return "Девочки";
  return "";
}

export function PublicOrderPage() {
  const { token = "" } = useParams();
  const [data, setData] = useState<PublicClassPayload | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [step, setStep] = useState<Step>("child");
  const [childId, setChildId] = useState(""); const [selected, setSelected] = useState<string[]>([]); const [pending, setPending] = useState(false);
  const [result, setResult] = useState<PublicOrderResult | null>(null); const [previewItem, setPreviewItem] = useState<CatalogEntry | null>(null); const [filter, setFilter] = useState("all");
  const requestKey = useRef(crypto.randomUUID());

  useEffect(() => { void (async () => { try { const payload = await getPublicClass(token); if (!payload) throw new Error("Ссылка недействительна или срок её действия истёк"); setData(payload); } catch (reason) { setError(humanError(reason)); } finally { setLoading(false); } })(); }, [token]);
  useEffect(() => { if (!previewItem) return; const previousOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = previousOverflow; }; }, [previewItem]);
  const child = data?.children.find((item) => item.id === childId);
  const total = useMemo(() => data?.catalog.filter((item) => selected.includes(item.id)).reduce((sum, item) => sum + Number(item.price), 0) || 0, [data, selected]);
  const filterOptions = useMemo(() => { const result = new Set<string>(); data?.catalog.forEach((item) => { if (item.gender === "boys" || item.gender === "girls") result.add(item.gender); if (item.category) result.add(`category:${item.category}`); }); return [...result]; }, [data]);
  const visibleItems = useMemo(() => data?.catalog.filter((item) => filter === "all" || filter === item.gender || filter === `category:${item.category}`) || [], [data, filter]);
  const groupedItems = useMemo(() => { const groups = new Map<string, CatalogEntry[]>(); visibleItems.forEach((item) => { const key = genderLabel(item.gender) || item.category || "Другое"; groups.set(key, [...(groups.get(key) || []), item]); }); return [...groups.entries()]; }, [visibleItems]);
  function toggle(id: string) { setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]); }
  async function submit() { if (!childId || !selected.length || pending) return; setPending(true); setError(""); try { const order = await submitPublicOrder({ token, childId, itemIds: selected, requestKey: requestKey.current, note: "" }); setResult(order); setStep("done"); } catch (reason) { setError(humanError(reason)); } finally { setPending(false); } }
  function renderCard(item: CatalogEntry) { const active = selected.includes(item.id); const openPreview = (event: MouseEvent | KeyboardEvent) => { event.preventDefault(); event.stopPropagation(); setPreviewItem(item); }; return <article className={`service-choice ${active ? "selected" : ""}`} key={item.id} role="button" tabIndex={0} onClick={() => setPreviewItem(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") openPreview(event); }}><span className="service-preview-button">{item.preview_video_url ? <video muted playsInline poster={item.preview_url || undefined} src={item.preview_video_url} /> : item.preview_url ? <img src={item.preview_url} alt="" /> : <ServiceIcon type={item.type} />}<span className="preview-hint">Смотреть</span></span><div className="service-copy"><strong>{item.name}</strong></div><b>{money(item.price)}</b><button type="button" className="service-check" aria-label={active ? `Убрать ${item.name}` : `Выбрать ${item.name}`} onClick={(event) => { event.stopPropagation(); toggle(item.id); }}>{active ? <Check size={17} /> : <Plus size={19} />}</button></article>; }
  if (loading) return <main className="public-page"><Loader label="Открываем класс…" /></main>;
  if (error && !data) return <main className="public-page"><section className="public-error"><div className="error-illustration">!</div><h1>Ссылка недоступна</h1><p>{error}</p><span>Попросите учителя отправить актуальную ссылку.</span></section></main>;
  if (!data) return null;
  return <main className="public-page"><div className="public-shell"><header className="public-header"><div className="public-logo"><span className="brand-mark">VS</span><div><strong>Vakha Studio</strong><small>Школьная фотография</small></div></div><span className="step-indicator">{step === "child" ? "Шаг 1 из 2" : step === "services" ? "Шаг 2 из 2" : "Готово"}</span></header>
    {step === "child" && <section className="public-content"><span className="eyebrow">{data.school.name} · {data.class.name}</span><h1>{data.class.photo_session_name}</h1><p className="public-lead">Выберите своего ребёнка</p>{!data.children.length ? <Notice kind="info">Список детей пока не добавлен. Обратитесь к учителю.</Notice> : <div className="children-grid">{data.children.map((item, index) => <button className="child-choice" key={item.id} onClick={() => { setChildId(item.id); setStep("services"); }}><span className={`avatar avatar-${index % 3}`}><UserRound /></span><strong>{item.public_name}</strong><span>›</span></button>)}</div>}<div className="privacy-note">Показываются только сокращённые публичные имена.</div></section>}
    {step === "services" && <section className="public-content service-step"><button className="back-link bare-button" onClick={() => setStep("child")}><ArrowLeft size={18} />Назад</button><span className="eyebrow">{data.school.name} · {data.class.name}</span><h1>{child?.public_name}</h1>{error && <Notice kind="error">{error}</Notice>}{filterOptions.length > 0 && <div className="catalog-filters"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Все</button>{filterOptions.map((option) => <button className={filter === option ? "active" : ""} key={option} onClick={() => setFilter(option)}>{option.startsWith("category:") ? option.slice(9) : genderLabel(option)}</button>)}</div>}{groupedItems.map(([group, groupItems]) => <section className="service-group" key={group}><h2>{group}</h2><div className="service-list">{groupItems.map(renderCard)}</div></section>)}{!data.catalog.length && <Notice kind="info">Каталог пуст.</Notice>}<div className="order-dock"><div><span>Выбрано: {selected.length}</span><strong>Итого: {money(total)}</strong></div><button className="button button-primary" disabled={!selected.length || pending} onClick={() => void submit()}>{pending && <LoaderCircle className="spin" size={18} />}Отправить заявку</button></div></section>}
    {previewItem && <Modal title={previewItem.name} onClose={() => setPreviewItem(null)}><section className="delivery-preview-copy"><h3>Что вы получите</h3><p>{previewItem.preview_url ? "Фото будет напечатано на листе A4." : "Цифровой результат доступен на телефоне."}</p></section><DeliveryPreview imageUrl={previewItem.preview_url} videoUrl={previewItem.preview_video_url} title={previewItem.name} mode={previewItem.parent_preview_mode}/><div className="viewer-meta"><strong>{money(previewItem.price)}</strong></div></Modal>}
    {step === "done" && result && <section className="success-screen"><div className="success-mark"><CheckCircle2 /></div><h1>{result.duplicate ? "Заявка уже была отправлена" : "Заявка отправлена"}</h1><span className="success-pill">Ваша заявка принята</span><div className="order-number">Номер заявки <strong>{result.order_number}</strong></div><div className="confirmation-card"><div><span>Ребёнок</span><strong>{result.child_name}</strong></div><div><span>Класс</span><strong>{result.class_name}</strong></div><div><span>Услуги</span><strong>{result.selected_items.map((item) => item.name).join(", ")}</strong></div><div><span>Итого</span><strong>{money(result.total_amount)}</strong></div></div><p>Спасибо! Мы сохраним прекрасные моменты детства.</p><button className="button button-primary button-wide" onClick={() => window.location.assign("about:blank")}>Готово</button></section>}
  </div></main>;
}
