import { ParentIntro } from "../components/ParentIntro";
import { ArrowLeft, Camera, CheckCircle2, LoaderCircle, Play, UserRound, Video } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader, Notice } from "../components/ui";
import { ServiceCard } from "../components/ServiceCard";
import { CatalogViewer } from "../components/CatalogViewer";
import { humanError, money } from "../lib/helpers";
import { buildCatalogSections, type CatalogGender } from "../lib/catalogSections";
import { getPublicClass, submitPublicOrder } from "../lib/publicRepository";
import type { PublicClassPayload, PublicOrderResult } from "../lib/types";

type Step = "child" | "services" | "done";
type CatalogEntry = PublicClassPayload["catalog"][number];

function ServiceIcon({ type }: { type: string }) {
  if (type === "video") return <Video />;
  if (type === "interview") return <Play />;
  if (type === "ai") return <UserRound />;
  return <Camera />;
}

export function PublicOrderPage() {
  const { token = "" } = useParams();
  const [introClosed, setIntroClosed] = useState(false);
  const [data, setData] = useState<PublicClassPayload | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [step, setStep] = useState<Step>("child");
  const [childId, setChildId] = useState(""); const [selected, setSelected] = useState<string[]>([]); const [pending, setPending] = useState(false);
  const [result, setResult] = useState<PublicOrderResult | null>(null); const [previewItem, setPreviewItem] = useState<CatalogEntry | null>(null); const [gender, setGender] = useState<CatalogGender>("all");
  const requestKey = useRef(crypto.randomUUID());

  useEffect(() => { void (async () => { try { const payload = await getPublicClass(token); if (!payload) throw new Error("Ссылка недействительна или срок её действия истёк"); setData(payload); } catch (reason) { setError(humanError(reason)); } finally { setLoading(false); } })(); }, [token]);
  useEffect(() => {
    let alive = true;
    async function refreshList() { try { const payload = await getPublicClass(token); if (alive && payload) setData(payload); } catch { /* Keep current selection during a temporary connection failure. */ } }
    const timer = window.setInterval(() => { if (!document.hidden) void refreshList(); }, 20000);
    window.addEventListener('focus', refreshList);
    return () => { alive = false; window.clearInterval(timer); window.removeEventListener('focus', refreshList); };
  }, [token]);
  const child = data?.children.find((item) => item.id === childId);
  const total = useMemo(() => data?.catalog.filter((item) => selected.includes(item.id)).reduce((sum, item) => sum + Number(item.price), 0) || 0, [data, selected]);
  const sections = useMemo(() => buildCatalogSections(data?.catalog || [], gender), [data, gender]);
  function toggle(id: string) { setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]); }
  async function submit() { if (!childId || !selected.length || pending) return; setPending(true); setError(""); try { const order = await submitPublicOrder({ token, childId, itemIds: selected, requestKey: requestKey.current, note: "" }); setData(current => current ? {...current, children: current.children.map(item => item.id === childId ? {...item, orders: [{status: order.status, items: order.selected_items}]} : item)} : current); setResult(order); setSelected(order.selected_items.map((item) => item.id)); setStep("done"); } catch (reason) { setError(humanError(reason)); } finally { setPending(false); } }
  function chooseAnotherChild() { requestKey.current = crypto.randomUUID(); setResult(null); setSelected([]); setChildId(""); setError(""); setPreviewItem(null); setStep("child"); }
  function orderLink(publicToken: string) { return `${window.location.origin}${import.meta.env.BASE_URL}order/${publicToken}`; }
  function whatsappUrl() {
    if (!data || !result) return "";
    const config = data.whatsapp || {};
    const services = result?.selected_items.map((item) => `${item.name} — ${money(item.price)}`).join("; ") || "";
    const template = config.template || "Здравствуйте! Направляю заявку на фотосъёмку для {child}.\\nКласс: {class}\\nУслуги: {services}\\nИтого: {total}\\nНомер заявки: {order_number}\\nСсылка на заявку: {order_link}";
    const message = template.replaceAll("{company}", config.company || "Vakha Studio").replaceAll("{manager}", config.manager || "").replaceAll("{child}", result?.child_name || "").replaceAll("{class}", result?.class_name || "").replaceAll("{services}", services).replaceAll("{total}", money(result?.total_amount || 0)).replaceAll("{order_number}", result?.order_number || "").replaceAll("{order_link}", result?.public_token ? orderLink(result.public_token) : "");
    const phone = (config.phone || "").replace(/\D/g, "");
    return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : "";
  }
  function renderCard(item: CatalogEntry, previewOnly = false) { return <ServiceCard key={item.id} item={item} selected={selected.includes(item.id)} related={previewOnly} onOpen={() => setPreviewItem(item)} onToggle={() => toggle(item.id)} />; }
  if (loading) return <main className="public-page"><Loader label="Открываем класс…" /></main>;
  if (error && !data) return <main className="public-page"><section className="public-error"><div className="error-illustration">!</div><h1>Ссылка недоступна</h1><p>{error}</p><span>Попросите учителя отправить актуальную ссылку.</span></section></main>;
  if (!data) return null;
  return <main className="public-page"><div className="public-shell"><header className="public-header"><div className="public-logo"><span className="brand-mark">VS</span><div><strong>Vakha Studio</strong><small>Школьная фотография</small></div></div><span className="step-indicator">{step === "child" ? "Шаг 1 из 2" : step === "services" ? "Шаг 2 из 2" : "Готово"}</span></header>
    <ParentIntro onComplete={() => setIntroClosed(true)} />
    {step === "child" && <section className="public-content"><span className="eyebrow">{data.school.name} · {data.class.name}</span><h1>{data.class.photo_session_name}</h1><p className="public-lead">Выберите своего ребёнка</p>{!data.children.length ? <Notice kind="info">Список детей пока не добавлен. Обратитесь к учителю.</Notice> : <div className="children-grid">{data.children.map((item, index) => <button className={`child-choice ${childId === item.id ? "is-current" : ""}`} aria-pressed={childId === item.id} key={item.id} onClick={() => { setChildId(item.id); if (introClosed) setStep("services"); }}><span className={`avatar avatar-${index % 3}`}><UserRound /></span><span className="child-choice-copy"><strong>{item.public_name}</strong><small>{item.orders?.length ? "Выбрал/а: " + item.orders.flatMap(order => order.items.map(service => `${service.name}${(service.quantity || 1) > 1 ? ` × ${service.quantity}` : ""}`)).join(", ") : "Пока без заявки"}</small></span><span className="child-order-previews">{item.orders?.flatMap(order => order.items).slice(0, 2).map((service, index) => { const named = data.catalog.filter(entry => entry.name === service.name); const image = service.preview_url || data.catalog.find(entry => entry.id === service.id)?.preview_url || (named.length === 1 ? named[0].preview_url : ""); return image ? <img key={`${service.id || service.name}-${index}`} src={image} alt={service.name} loading="lazy" /> : null; })}</span></button>)}</div>}{childId && <div className="child-catalog-entry"><button className="button button-primary" disabled={!introClosed} onClick={() => setStep("services")}>{introClosed ? "Открыть каталог фотографий" : "Каталог откроется после видео"}</button></div>}<div className="privacy-note">Выберите своего ребёнка из списка класса.</div></section>}
    {step === "services" && <section className="public-content service-step"><button className="back-link bare-button" onClick={() => setStep("child")}><ArrowLeft size={18} />Назад</button><span className="eyebrow">{data.school.name} · {data.class.name}</span><h1>{child?.public_name}</h1>{error && <Notice kind="error">{error}</Notice>}{data.catalog.length > 0 && <div className="catalog-gender-tabs" role="group" aria-label="Категория ребёнка"><button className={gender === "all" ? "active" : ""} onClick={() => setGender("all")}>Все</button><button className={gender === "boys" ? "active" : ""} onClick={() => setGender("boys")}>Мальчики</button><button className={gender === "girls" ? "active" : ""} onClick={() => setGender("girls")}>Девочки</button></div>}<div className="catalog-section-list">{sections.map((section) => <section className="service-group catalog-section" key={section.id}><h2>{section.title}</h2>{section.notice && <div className="catalog-video-notice"><Video size={20}/><span>{section.notice}</span></div>}{section.items.length > 0 && <div className="service-list">{section.items.map((item) => renderCard(item))}</div>}{section.relatedItems?.length ? <><h3 className="catalog-related-title">{section.relatedTitle}</h3><div className="service-list">{section.relatedItems.map((item) => renderCard(item, true))}</div></> : null}</section>)}</div>{!data.catalog.length && <Notice kind="info">Каталог пуст.</Notice>}{selected.length > 0 && <div className="order-dock"><div><span>Выбрано: {selected.length}</span><strong>Итого: {money(total)}</strong></div><button className="button button-primary" disabled={pending} onClick={() => void submit()}>{pending && <LoaderCircle className="spin" size={18} />}Оформить заявку</button></div>}</section>}
    {previewItem && <CatalogViewer items={data.catalog} initialId={previewItem.id} initialGender={gender} selected={selected} onToggle={toggle} onClose={() => setPreviewItem(null)} />}
    {step === "done" && result && <section className="success-screen"><div className="success-mark"><CheckCircle2 /></div><h1>{result.duplicate ? "Заявка уже была отправлена" : "Заявка отправлена"}</h1><span className="success-pill">Ваша заявка принята</span><div className="order-number">Номер заявки <strong>{result.order_number}</strong></div><div className="confirmation-card"><div><span>Ребёнок</span><strong>{result.child_name}</strong></div><div><span>Класс</span><strong>{result.class_name}</strong></div><div><span>Услуги</span><strong>{result.selected_items.map((item) => `${item.name}${(item.quantity || 1) > 1 ? ` × ${item.quantity}` : ""}${item.comment ? ` (${item.comment})` : ""}`).join(", ")}</strong></div><div><span>Итого</span><strong>{money(result.total_amount)}</strong></div></div><div className="success-items">{result.selected_items.map((item) => <div className="success-item" key={item.id}>{item.preview_url ? <img src={item.preview_url} alt="" loading="lazy" decoding="async" /> : <ServiceIcon type={item.type} />}<span>{item.name}{(item.quantity || 1) > 1 ? ` × ${item.quantity}` : ""}</span><strong>{money(item.price * (item.quantity || 1))}</strong></div>)}</div><p>Спасибо! Мы сохраним прекрасные моменты детства.</p><div className="success-actions">{import.meta.env.VITE_CRM_MODE === "true" && <a className="button button-primary" href={orderLink(result.public_token)}>Открыть мой заказ</a>}<button className="button button-secondary" onClick={() => setStep("services")}><ArrowLeft size={18}/>Назад к выбору</button>{data.children.length > 1 && <button className="button button-secondary" onClick={chooseAnotherChild}>Выбрать другого ребёнка</button>}{whatsappUrl() && <a className="button button-primary" href={whatsappUrl()} target="_blank" rel="noreferrer">Отправить в WhatsApp</a>}<button className="button button-primary button-wide" onClick={chooseAnotherChild}>Готово</button></div></section>}
  </div></main>;
}
