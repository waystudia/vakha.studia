import { hasWatchedParentIntro } from "../lib/parentIntroProgress";
import { ParentIntro } from "../components/ParentIntro";
import { ArrowLeft, Camera, CheckCircle2, LoaderCircle, Play, ShieldCheck, ShieldOff, ShoppingCart, Trash2, UserRound, Video, X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Loader, Notice } from "../components/ui";
import { ServiceCard } from "../components/ServiceCard";
import { CatalogViewer } from "../components/CatalogViewer";
import { humanError, money } from "../lib/helpers";
import { buildCatalogSections, type CatalogGender } from "../lib/catalogSections";
import { cancelPublicOrder, getPublicClass, submitPublicOrder } from "../lib/publicRepository";
import type { PublicClassPayload, PublicOrderResult } from "../lib/types";

type Step = "child" | "services" | "done";
type CatalogEntry = PublicClassPayload["catalog"][number];

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

function OrderCart({ items, total, open, pending, editing, withoutLamination, onOpen, onClose, onRemove, onLaminationChange, onSubmit }: {
  items: CatalogEntry[];
  total: number;
  open: boolean;
  pending: boolean;
  editing: boolean;
  withoutLamination: string[];
  onOpen: () => void;
  onClose: () => void;
  onRemove: (id: string) => void;
  onLaminationChange: (id: string, withLamination: boolean) => void;
  onSubmit: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const first = items[0];
  useEffect(() => { if (open) closeButton.current?.focus(); }, [open]);
  return <>
    <button className="order-cart-trigger" type="button" aria-haspopup="dialog" aria-expanded={open} onClick={onOpen}>
      <span className="order-cart-trigger-preview">{first?.preview_url ? <img src={first.preview_url} alt="" /> : <ServiceIcon type={first?.type || "photo"} />}</span>
      <span className="order-cart-trigger-copy"><strong><ShoppingCart aria-hidden="true" />Корзина</strong><small>{items.length} · {money(total)}</small></span>
      <span className="order-cart-count" aria-hidden="true">{items.length}</span>
    </button>
    <div className="order-cart-layer" data-open={open} aria-hidden={!open} onClick={onClose}>
      <section className="order-cart-sheet" role="dialog" aria-modal="true" aria-labelledby="order-cart-title" onClick={event => event.stopPropagation()}>
        <div className="order-cart-handle" aria-hidden="true" />
        <header><div><span>Ваш выбор</span><h2 id="order-cart-title">Корзина</h2></div><button ref={closeButton} type="button" className="order-cart-close" aria-label="Закрыть корзину" onClick={onClose}><X /></button></header>
        <div className="order-cart-items">{items.map(item => {
          const protectedPhoto = !withoutLamination.includes(item.id);
          return <article className="order-cart-item" key={item.id}>
            <div className="order-cart-photo">{item.preview_url ? <img src={item.preview_url} alt={item.name} /> : <ServiceIcon type={item.type} />}</div>
            <div className="order-cart-item-copy"><strong>{item.name}</strong><b>{money(Math.max(0, Number(item.price) - (protectedPhoto ? 0 : 50)))}</b></div>
            <button type="button" className="order-cart-remove" aria-label={`Убрать ${item.name} из корзины`} onClick={() => onRemove(item.id)}><Trash2 /></button>
            <div className="order-cart-protection" role="radiogroup" aria-label={`Защита: ${item.name}`}>
              <button type="button" role="radio" aria-checked={protectedPhoto} className={protectedPhoto ? "active" : ""} onClick={() => onLaminationChange(item.id, true)}><ShieldCheck />С защитой</button>
              <button type="button" role="radio" aria-checked={!protectedPhoto} className={!protectedPhoto ? "active" : ""} onClick={() => onLaminationChange(item.id, false)}><ShieldOff />Без защиты</button>
            </div>
          </article>;
        })}</div>
        <button type="button" className="order-cart-add-more" onClick={onClose}>+ Добавить ещё услугу из каталога</button>
        <footer><div><span>Итого</span><strong>{money(total)}</strong></div><button className="button button-primary" disabled={pending} onClick={onSubmit}>{pending && <LoaderCircle className="spin" size={18} />}{editing ? "Сохранить изменения" : "Оформить заявку"}</button></footer>
      </section>
    </div>
  </>;
}

export function PublicOrderPage() {
  const { token = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [introClosed, setIntroClosed] = useState(hasWatchedParentIntro);
  const [data, setData] = useState<PublicClassPayload | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [step, setStep] = useState<Step>("child");
  const [childId, setChildId] = useState(""); const [selected, setSelected] = useState<string[]>([]); const [pending, setPending] = useState(false);
  const [withoutLamination, setWithoutLamination] = useState<string[]>([]);
  const [lastRemovedId, setLastRemovedId] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [result, setResult] = useState<PublicOrderResult | null>(null); const [previewItem, setPreviewItem] = useState<CatalogEntry | null>(null); const [gender, setGender] = useState<CatalogGender>("all");
  const [activeCategory, setActiveCategory] = useState("");
  const requestKey = useRef(crypto.randomUUID());
  const childOrigin = useRef<{ scrollY: number; childId: string }>({ scrollY: 0, childId: "" });
  const serviceScrollTarget = useRef("");
  const servicesEntry = useRef("");
  const servicesArmed = useRef(false);
  const stepRef = useRef<Step>("child");
  stepRef.current = step;

  useEffect(() => { void (async () => { try { const payload = await getPublicClass(token); if (!payload) throw new Error("Ссылка недействительна или срок её действия истёк"); setData(payload); } catch (reason) { setError(humanError(reason)); } finally { setLoading(false); } })(); }, [token]);
  useEffect(() => {
    let alive = true;
    async function refreshList() { try { const payload = await getPublicClass(token); if (alive && payload) setData(payload); } catch { /* Keep current selection during a temporary connection failure. */ } }
    const timer = window.setInterval(() => { if (!document.hidden) void refreshList(); }, 20000);
    window.addEventListener('focus', refreshList);
    return () => { alive = false; window.clearInterval(timer); window.removeEventListener('focus', refreshList); };
  }, [token]);
  useEffect(() => {
    if (!cartOpen) return;
    document.body.classList.add("order-cart-open");
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setCartOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.classList.remove("order-cart-open"); window.removeEventListener("keydown", closeOnEscape); };
  }, [cartOpen]);
  useLayoutEffect(() => {
    if (step !== "services") return;
    const targetId = serviceScrollTarget.current;
    if (!targetId) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      return;
    }
    const frame = requestAnimationFrame(() => {
      const target = Array.from(document.querySelectorAll<HTMLElement>("[data-service-id]"))
        .find((element) => element.dataset.serviceId === targetId);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        serviceScrollTarget.current = "";
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [step]);
  useEffect(() => {
    if (location.state?.publicOrderServices === servicesEntry.current && servicesEntry.current) servicesArmed.current = true;
    else if (servicesArmed.current && stepRef.current === "services") restoreChildren();
  }, [location]);
  const child = data?.children.find((item) => item.id === childId);
  const editingExisting = Boolean(child?.orders?.some((order) => order.status !== "cancelled"));
  const selectedCatalogItems = useMemo(() => data?.catalog.filter((item) => selected.includes(item.id)) || [], [data, selected]);
  const total = useMemo(() => data?.catalog.filter((item) => selected.includes(item.id)).reduce((sum, item) => sum + Math.max(0, Number(item.price) - (withoutLamination.includes(item.id) ? 50 : 0)), 0) || 0, [data, selected, withoutLamination]);
  const sections = useMemo(() => buildCatalogSections(data?.catalog || [], gender), [data, gender]);
  useEffect(() => {
    if (!sections.length) return;
    if (!sections.some((section) => section.id === activeCategory)) setActiveCategory(sections[0].id);
  }, [activeCategory, sections]);
  useEffect(() => {
    if (step !== "services" || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
      const id = (visible?.target as HTMLElement | undefined)?.dataset.catalogSection;
      if (id) setActiveCategory(id);
    }, { rootMargin: "-140px 0px -48% 0px", threshold: [0.05, 0.25, 0.6] });
    const nodes = document.querySelectorAll<HTMLElement>("[data-catalog-section]");
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [sections, step]);
  function scrollToCategory(id: string) {
    setActiveCategory(id);
    const target = Array.from(document.querySelectorAll<HTMLElement>("[data-catalog-section]"))
      .find((element) => element.dataset.catalogSection === id);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function toggle(id: string) {
    setSelected((items) => {
      if (items.includes(id)) { setLastRemovedId(id); return items.filter((item) => item !== id); }
      setLastRemovedId(""); return [...items, id];
    });
  }
  function restoreLastRemoved() {
    if (!lastRemovedId) return;
    setSelected((items) => items.includes(lastRemovedId) ? items : [...items, lastRemovedId]);
    setLastRemovedId("");
  }
  function setLamination(id: string, withLamination: boolean) { setWithoutLamination((items) => withLamination ? items.filter((item) => item !== id) : items.includes(id) ? items : [...items, id]); }
  function openServices(id: string) {
    const order = data?.children.find((item) => item.id === id)?.orders?.[0];
    const restored = order?.items.flatMap((item) => {
      if (item.id && data?.catalog.some((entry) => entry.id === item.id)) return [item.id];
      const named = data?.catalog.filter((entry) => entry.name === item.name) || [];
      return named.length === 1 ? [named[0].id] : [];
    }) || [];
    const unprotected = order?.items.flatMap((item) => {
      if (item.comment !== "Без ламинации (защиты)") return [];
      if (item.id && restored.includes(item.id)) return [item.id];
      const named = data?.catalog.filter((entry) => entry.name === item.name) || [];
      return named.length === 1 ? [named[0].id] : [];
    }) || [];
    childOrigin.current = { scrollY: window.scrollY, childId: id };
    servicesEntry.current = crypto.randomUUID();
    servicesArmed.current = false;
    requestKey.current = crypto.randomUUID();
    serviceScrollTarget.current = restored[0] || "";
    setLastRemovedId("");
    setSelected([...new Set(restored)]); setWithoutLamination([...new Set(unprotected)]); setResult(null); setError("");
    setChildId(id); setStep("services");
    navigate({ pathname: location.pathname, search: location.search, hash: location.hash }, { state: { ...location.state, publicOrderServices: servicesEntry.current }, preventScrollReset: true });
  }
  function restoreChildren() {
    servicesArmed.current = false; setStep("child");
    requestAnimationFrame(() => { window.scrollTo({ top: childOrigin.current.scrollY, left: 0, behavior: "instant" }); document.querySelector<HTMLElement>(`[data-child-id="${childOrigin.current.childId}"]`)?.focus({ preventScroll: true }); });
  }
  function closeServices() {
    if (location.state?.publicOrderServices === servicesEntry.current) navigate(-1);
    else restoreChildren();
  }
  async function submit() { if (!childId || pending || (!selected.length && !editingExisting)) return; setPending(true); setError(""); setNotice(""); try { if (!selected.length) { await cancelPublicOrder({ token, childId }); setData(current => current ? {...current, children: current.children.map(item => item.id === childId ? {...item, orders: []} : item)} : current); setWithoutLamination([]); setNotice("Заявка удалена. Можно выбрать услуги заново."); restoreChildren(); return; } const order = await submitPublicOrder({ token, childId, itemIds: selected, withoutLaminationIds: withoutLamination.filter((id) => selected.includes(id)), requestKey: requestKey.current, note: "" }); setData(current => current ? {...current, children: current.children.map(item => item.id === childId ? {...item, orders: [{status: order.status, items: order.selected_items}]} : item)} : current); setResult(order); setSelected(order.selected_items.map((item) => item.id)); setWithoutLamination(order.selected_items.filter((item) => item.comment === "Без ламинации (защиты)").map((item) => item.id)); setStep("done"); } catch (reason) { setError(humanError(reason)); } finally { setPending(false); } }
  function chooseAnotherChild() { requestKey.current = crypto.randomUUID(); setResult(null); setSelected([]); setWithoutLamination([]); setChildId(""); setError(""); setPreviewItem(null); setStep("child"); }
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
  function renderCard(item: CatalogEntry, previewOnly = false) { return <ServiceCard key={item.id} item={item} selected={selected.includes(item.id)} related={previewOnly} withLamination={!withoutLamination.includes(item.id)} onOpen={() => setPreviewItem(item)} onToggle={() => toggle(item.id)} onLaminationChange={previewOnly ? undefined : (value) => setLamination(item.id, value)} />; }
  if (loading) return <main className="public-page"><Loader label="Открываем класс…" /></main>;
  if (error && !data) return <main className="public-page"><section className="public-error"><div className="error-illustration">!</div><h1>Ссылка недоступна</h1><p>{error}</p><span>Попросите учителя отправить актуальную ссылку.</span></section></main>;
  if (!data) return null;
  return <main className="public-page"><div className="public-shell"><header className="public-header"><div className="public-logo"><span className="brand-mark">VS</span><div><strong>Vakha Studio</strong><small>Школьная фотография</small></div></div><span className="step-indicator">{step === "child" ? "Шаг 1 из 2" : step === "services" ? "Шаг 2 из 2" : "Готово"}</span></header>
    <ParentIntro watched={introClosed} onComplete={() => setIntroClosed(true)} />
    {step === "child" && notice && <div className="public-inline-notice"><Notice kind="info">{notice}</Notice></div>}
    {step === "child" && <section className="public-content"><span className="eyebrow">{data.school.name} · {data.class.name}</span><h1>{data.class.photo_session_name}</h1><p className="public-lead">Выберите своего ребёнка</p>{!data.children.length ? <Notice kind="info">Список детей пока не добавлен. Обратитесь к учителю.</Notice> : <div className="children-grid">{data.children.map((item, index) => <button className={`child-choice ${childId === item.id ? "is-current" : ""}`} data-child-id={item.id} aria-pressed={childId === item.id} key={item.id} onClick={() => { setChildId(item.id); if (introClosed) openServices(item.id); }}><span className={`avatar avatar-${index % 3}`}><UserRound /></span><span className="child-choice-copy"><strong>{item.public_name}</strong><small>{item.orders?.length ? "Выбрал/а: " + item.orders.flatMap(order => order.items.map(service => `${service.name}${(service.quantity || 1) > 1 ? ` × ${service.quantity}` : ""}`)).join(", ") : "Пока без заявки"}</small></span><span className="child-order-previews">{item.orders?.flatMap(order => order.items).slice(0, 2).map((service, index) => { const named = data.catalog.filter(entry => entry.name === service.name); const image = data.catalog.find(entry => entry.id === service.id)?.preview_url || (named.length === 1 ? named[0].preview_url : "") || service.preview_url; return image ? <img key={`${service.id || service.name}-${index}`} src={image} alt={service.name} loading="lazy" onError={event => { const image = event.currentTarget; const named = data.catalog.filter(entry => entry.name === service.name); const fallback = named.length === 1 ? named[0].preview_url : ""; if (fallback && image.getAttribute("src") !== fallback) image.src = fallback; }} /> : null; })}</span></button>)}</div>}{childId && <div className="child-catalog-entry"><button className="button button-primary" disabled={!introClosed} onClick={() => openServices(childId)}>{introClosed ? "Открыть каталог фотографий" : "Каталог откроется после видео"}</button></div>}<div className="privacy-note">Выберите своего ребёнка из списка класса.</div></section>}
    {step === "services" && <section className="public-content service-step">
      <button className="service-back-floating" type="button" aria-label="Назад к списку детей" onClick={closeServices}><ArrowLeft size={20} /><span>Назад</span></button>
      <span className="eyebrow">{data.school.name} · {data.class.name}</span><h1>{child?.public_name}</h1>
      {error && <Notice kind="error">{error}</Notice>}
      {sections.length > 0 && <div className="catalog-category-cards" aria-label="Категории услуг">
        {sections.map((section) => {
          const cover = section.items.find((item) => item.preview_url)?.preview_url;
          return <button type="button" className="catalog-category-card" key={section.id} aria-label={`Перейти к категории ${section.title}`} onClick={() => scrollToCategory(section.id)}>
            <span className="catalog-category-media">{cover ? <img src={cover} alt="" loading="lazy" decoding="async" /> : <ServiceIcon type={section.items[0]?.type || "photo"} />}</span>
            <span className="catalog-category-copy"><strong>{section.title}</strong><small>{serviceCountLabel(section.items.length)}</small></span>
          </button>;
        })}
      </div>}
      {data.catalog.length > 0 && <div className="catalog-sticky-filters">
        <div className="catalog-gender-tabs" role="group" aria-label="Категория ребёнка">
          <button className={gender === "all" ? "active" : ""} onClick={() => setGender("all")}>Все</button>
          <button className={gender === "boys" ? "active" : ""} onClick={() => setGender("boys")}>Мальчики</button>
          <button className={gender === "girls" ? "active" : ""} onClick={() => setGender("girls")}>Девочки</button>
        </div>
        <nav className="catalog-jump-nav" aria-label="Быстрый переход по категориям">
          {sections.map((section) => <button type="button" key={section.id} className={activeCategory === section.id ? "active" : ""} aria-current={activeCategory === section.id ? "true" : undefined} onClick={() => scrollToCategory(section.id)}>{section.title}</button>)}
        </nav>
      </div>}
      <div className="catalog-section-list">{sections.map((section) => <section className="service-group catalog-section" data-catalog-section={section.id} key={section.id}><h2>{section.title}</h2>{section.notice && <div className="catalog-video-notice"><Video size={20}/><span>{section.notice}</span></div>}{section.items.length > 0 && <div className="service-list">{section.items.map((item) => renderCard(item))}</div>}{section.relatedItems?.length ? <><h3 className="catalog-related-title">{section.relatedTitle}</h3><div className="service-list">{section.relatedItems.map((item) => renderCard(item, true))}</div></> : null}</section>)}</div>
      {!data.catalog.length && <Notice kind="info">Каталог пуст.</Notice>}
      {selected.length > 0 && <OrderCart items={selectedCatalogItems} total={total} open={cartOpen} pending={pending} editing={editingExisting} withoutLamination={withoutLamination} onOpen={() => setCartOpen(true)} onClose={() => setCartOpen(false)} onRemove={toggle} onLaminationChange={setLamination} onSubmit={() => void submit()} />}
    </section>}
    {step === "services" && selected.length === 0 && editingExisting && <div className="empty-order-dock"><span>Вы убрали последнюю услугу. Удалить заявку целиком?</span><div className="empty-order-actions"><button className="button button-secondary" disabled={pending} onClick={restoreLastRemoved}>Нет, вернуть</button><button className="button button-danger" disabled={pending} onClick={() => void submit()}>{pending && <LoaderCircle className="spin" size={18} />}Да, удалить</button></div></div>}
    {previewItem && <CatalogViewer items={data.catalog} initialId={previewItem.id} initialGender={gender} selected={selected} onToggle={toggle} onClose={() => setPreviewItem(null)} />}
    {step === "done" && result && <section className="success-screen"><div className="success-mark"><CheckCircle2 /></div><h1>{result.duplicate ? "Заявка уже была отправлена" : "Заявка отправлена"}</h1><span className="success-pill">Ваша заявка принята</span><div className="order-number">Номер заявки <strong>{result.order_number}</strong></div><div className="confirmation-card"><div><span>Ребёнок</span><strong>{result.child_name}</strong></div><div><span>Класс</span><strong>{result.class_name}</strong></div><div><span>Услуги</span><strong>{result.selected_items.map((item) => `${item.name}${(item.quantity || 1) > 1 ? ` × ${item.quantity}` : ""}${item.comment ? ` (${item.comment})` : ""}`).join(", ")}</strong></div><div><span>Итого</span><strong>{money(result.total_amount)}</strong></div></div><div className="success-items">{result.selected_items.map((item) => <div className="success-item" key={item.id}>{item.preview_url ? <img src={item.preview_url} alt="" loading="lazy" decoding="async" /> : <ServiceIcon type={item.type} />}<span>{item.name}{(item.quantity || 1) > 1 ? ` × ${item.quantity}` : ""}</span><strong>{money(item.price * (item.quantity || 1))}</strong></div>)}</div><p>Спасибо! Мы сохраним прекрасные моменты детства.</p><div className="success-actions">{import.meta.env.VITE_CRM_MODE === "true" && <a className="button button-primary" href={orderLink(result.public_token)}>Открыть мой заказ</a>}<button className="button button-secondary" onClick={() => setStep("services")}><ArrowLeft size={18}/>Назад к выбору</button>{data.children.length > 1 && <button className="button button-secondary" onClick={chooseAnotherChild}>Выбрать другого ребёнка</button>}{whatsappUrl() && <a className="button button-primary" href={whatsappUrl()} target="_blank" rel="noreferrer">Отправить в WhatsApp</a>}<button className="button button-primary button-wide" onClick={chooseAnotherChild}>Готово</button></div></section>}
  </div></main>;
}
