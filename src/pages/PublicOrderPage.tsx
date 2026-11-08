import { hasWatchedParentIntro } from "../lib/parentIntroProgress";
import { ParentIntro } from "../components/ParentIntro";
import { ArrowLeft, Camera, CheckCircle2, ImagePlus, LoaderCircle, MessageSquarePlus, Play, ShieldCheck, ShieldOff, ShoppingCart, Sparkles, Trash2, UserRound, Video, X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Modal, Notice } from "../components/ui";
import { ServiceCard } from "../components/ServiceCard";
import { CatalogViewer } from "../components/CatalogViewer";
import { humanError, money } from "../lib/helpers";
import { buildCatalogSections, type CatalogGender } from "../lib/catalogSections";
import { catalogMediaUrl } from "../lib/mediaUrl";
import { attachPublicServiceVideo, cancelPublicOrder, getPublicClass, submitPublicCustomRequest, submitPublicOrder } from "../lib/publicRepository";
import { optimizeCatalogVideo } from "../lib/optimizeCatalogMedia";
import { trackPublicVisit } from "../lib/visitAnalytics";
import type { PublicClassPayload, PublicOrderResult, PublicSelectedOrderItem } from "../lib/types";

type Step = "child" | "services" | "done";
type CatalogEntry = PublicClassPayload["catalog"][number];
type ServicePreference = { comment: string; videoAddonRequested: boolean; videoFile?: File; videoName?: string };
const russianNameCollator = new Intl.Collator("ru", { sensitivity: "base", numeric: true });

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

function PublicLoadingScreen() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setProgress(current => Math.min(92, current + (current < 45 ? 7 : current < 75 ? 3 : 1))), 180);
    return () => window.clearInterval(timer);
  }, []);
  return <main className="kz-loading-screen" role="status" aria-live="polite" aria-label="Загружаем каталог"><div className="kz-loading-card"><div className="kz-loading-mark" aria-hidden="true">KZ</div><h1>Khan Zama</h1><p>Сохраняем детство во времени</p><div className="kz-loading-progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div><div className="kz-loading-status"><span>Подождите, скоро загрузится</span><strong>{progress}%</strong></div></div></main>;
}

function OrderCart({ items, customItems, total, open, pending, editing, withoutLamination, preferences, onOpen, onClose, onRemove, onLaminationChange, onPreference, onSubmit }: {
  items: CatalogEntry[];
  customItems: PublicSelectedOrderItem[];
  total: number;
  open: boolean;
  pending: boolean;
  editing: boolean;
  withoutLamination: string[];
  preferences: Record<string, ServicePreference>;
  onOpen: () => void;
  onClose: () => void;
  onRemove: (id: string) => void;
  onLaminationChange: (id: string, withLamination: boolean) => void;
  onPreference: (item: CatalogEntry) => void;
  onSubmit: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const dragStart = useRef<{ y: number; x: number; time: number; active: boolean; scrollArea: HTMLElement | null; scrollTop: number }>({ y: 0, x: 0, time: 0, active: false, scrollArea: null, scrollTop: 0 });
  const dragDistance = useRef(0);
  const suppressDragClick = useRef(false);
  const [dragY, setDragY] = useState(0);
  const allCount = items.length + customItems.length;
  const first = items[0] || customItems[0];
  useEffect(() => { if (open) closeButton.current?.focus(); }, [open]);
  useEffect(() => { if (!open) setDragY(0); }, [open]);
  function startDrag(event: React.PointerEvent<HTMLElement>) {
    if (event.isPrimary === false) return;
    const scrollArea = (event.target as HTMLElement).closest<HTMLElement>(".order-cart-items");
    dragDistance.current = 0;
    suppressDragClick.current = false;
    dragStart.current = { y: event.clientY, x: event.clientX, time: performance.now(), active: true, scrollArea, scrollTop: scrollArea?.scrollTop || 0 };
  }
  function moveDrag(event: React.PointerEvent<HTMLElement>) {
    const start = dragStart.current;
    if (!start.active) return;
    const distance = event.clientY - start.y;
    const horizontal = Math.abs(event.clientX - start.x);
    if (horizontal > Math.abs(distance)) return;
    if (Math.abs(distance) > 8 && !event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    if (start.scrollArea) {
      const nextScrollTop = start.scrollTop - distance;
      if (nextScrollTop >= 0) {
        start.scrollArea.scrollTop = nextScrollTop;
        dragDistance.current = 0;
        setDragY(0);
        return;
      }
    }
    const sheetDistance = Math.max(0, distance - start.scrollTop);
    dragDistance.current = sheetDistance;
    suppressDragClick.current = sheetDistance > 8;
    setDragY(sheetDistance);
  }
  function finishDrag(event: React.PointerEvent<HTMLElement>) {
    if (!dragStart.current.active) return;
    const elapsed = Math.max(1, performance.now() - dragStart.current.time);
    const shouldClose = dragDistance.current >= 72 || dragDistance.current / elapsed >= .55;
    dragStart.current.active = false;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture?.(event.pointerId);
    setDragY(0);
    if (shouldClose) onClose();
  }
  return <>
    <button className="order-cart-trigger" type="button" aria-label={`Оформить заказ. Корзина: ${allCount}, ${money(total)}`} aria-haspopup="dialog" aria-expanded={open} onClick={onOpen}>
      <span className="order-cart-trigger-preview">{first?.preview_url ? <img src={first.preview_url} alt="" /> : <ServiceIcon type={first?.type || "photo"} />}</span>
      <span className="order-cart-trigger-copy"><strong><ShoppingCart aria-hidden="true" />Оформить заказ</strong><small>{allCount} · {money(total)}</small></span>
      <span className="order-cart-count" aria-hidden="true">{allCount}</span>
    </button>
    <div className="order-cart-layer" data-open={open} aria-hidden={!open} onClick={onClose}>
      <section className="order-cart-sheet" data-dragging={dragY > 0} style={dragY > 0 ? { transform: `translateY(${dragY}px)` } : undefined} role="dialog" aria-modal="true" aria-labelledby="order-cart-title" onClickCapture={event => { if (suppressDragClick.current) { event.preventDefault(); event.stopPropagation(); suppressDragClick.current = false; } }} onClick={event => event.stopPropagation()} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag}>
        <div className="order-cart-handle" aria-hidden="true" />
        <header><div><span>Ваш выбор</span><h2 id="order-cart-title">Корзина</h2></div><button ref={closeButton} type="button" className="order-cart-close" aria-label="Закрыть корзину" onClick={onClose}><X /></button></header>
        <div className="order-cart-items">{customItems.map((item, index) => <article className="order-cart-item order-cart-custom-item" key={item.id || `custom-${index}`}>
          <div className="order-cart-photo">{item.preview_url ? <img src={item.preview_url} alt={item.reference_name || item.reference_service_name || "Референс"} /> : <ImagePlus />}</div>
          <div className="order-cart-item-copy"><strong>Индивидуальный заказ</strong>{item.reference_service_name && <b>{item.reference_service_name}</b>}</div>
          <span className="order-cart-custom-badge">{item.reference_path ? "Скрин прикреплён" : "По каталогу"}</span>
          {item.comment && <p className="order-cart-custom-comment">{item.comment}</p>}
        </article>)}{items.map(item => {
          const protectedPhoto = !withoutLamination.includes(item.id);
          return <article className="order-cart-item" key={item.id}>
            <div className="order-cart-photo">{item.preview_url ? <img src={item.preview_url} alt={item.name} /> : <ServiceIcon type={item.type} />}</div>
            <div className="order-cart-item-copy"><strong>{item.name}</strong><b>{money(Math.max(0, Number(item.price) - (protectedPhoto ? 0 : 50)))}</b></div>
            <button type="button" className="order-cart-remove" aria-label={`Убрать ${item.name} из корзины`} onClick={() => onRemove(item.id)}><Trash2 /></button>
            <div className="order-cart-protection" role="radiogroup" aria-label={`Защита: ${item.name}`}>
              <button type="button" role="radio" aria-checked={protectedPhoto} className={protectedPhoto ? "active" : ""} onClick={() => onLaminationChange(item.id, true)}><ShieldCheck />С защитой</button>
              <button type="button" role="radio" aria-checked={!protectedPhoto} className={!protectedPhoto ? "active" : ""} onClick={() => onLaminationChange(item.id, false)}><ShieldOff />Без защиты</button>
            </div>
            <button type="button" className={`order-cart-preference${preferences[item.id]?.comment || preferences[item.id]?.videoAddonRequested ? " has-value" : ""}`} onClick={() => onPreference(item)}><MessageSquarePlus />{preferences[item.id]?.comment || preferences[item.id]?.videoAddonRequested ? "Изменить пожелание" : "Добавить пожелание"}</button>
            {(preferences[item.id]?.comment || preferences[item.id]?.videoAddonRequested) && <div className="order-cart-preference-summary">{preferences[item.id]?.videoAddonRequested && <span><Video/>Оживление фото · +500 ₽</span>}{preferences[item.id]?.videoName && <small>Прикреплено: {preferences[item.id].videoName}</small>}{preferences[item.id]?.comment && <small>{preferences[item.id].comment}</small>}</div>}
          </article>;
        })}</div>
        <button type="button" className="order-cart-add-more" onClick={onClose}>+ Добавить ещё услугу из каталога</button>
        <footer><div><span>Итого</span><strong>{money(total)}</strong></div>{items.length > 0
          ? <button className="button button-primary" disabled={pending} onClick={onSubmit}>{pending && <LoaderCircle className="spin" size={18} />}{editing ? "Сохранить изменения" : "Оформить заявку"}</button>
          : <button className="button button-primary" onClick={onClose}>Готово</button>}</footer>
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
  const [servicePreferences, setServicePreferences] = useState<Record<string, ServicePreference>>({});
  const [preferenceItem, setPreferenceItem] = useState<CatalogEntry | null>(null);
  const [preferenceDraft, setPreferenceDraft] = useState<ServicePreference>({ comment: "", videoAddonRequested: false });
  const [uploadStatus, setUploadStatus] = useState("");
  const [lastRemovedId, setLastRemovedId] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [customRequestOpen, setCustomRequestOpen] = useState(false);
  const [customReferenceFile, setCustomReferenceFile] = useState<File | null>(null);
  const [customReferenceServiceId, setCustomReferenceServiceId] = useState("");
  const [customServiceSearch, setCustomServiceSearch] = useState("");
  const [customReferencePreview, setCustomReferencePreview] = useState("");
  const [result, setResult] = useState<PublicOrderResult | null>(null); const [previewItem, setPreviewItem] = useState<CatalogEntry | null>(null); const [gender, setGender] = useState<CatalogGender>("all");
  const [activeCategory, setActiveCategory] = useState("all");
  const [filtersPinned, setFiltersPinned] = useState(false);
  const requestKey = useRef(crypto.randomUUID());
  const categoryCardsRef = useRef<HTMLDivElement | null>(null);
  const childOrigin = useRef<{ scrollY: number; childId: string }>({ scrollY: 0, childId: "" });
  const serviceScrollTarget = useRef("");
  const checkoutAfterViewer = useRef(false);
  const servicesEntry = useRef("");
  const servicesArmed = useRef(false);
  const stepRef = useRef<Step>("child");
  stepRef.current = step;

  useEffect(() => { trackPublicVisit(token, "class"); }, [token]);
  useEffect(() => { void (async () => { try { const payload = await getPublicClass(token); if (!payload) throw new Error("Ссылка недействительна или срок её действия истёк"); setData(payload); } catch (reason) { setError(humanError(reason)); } finally { setLoading(false); } })(); }, [token]);
  useEffect(() => {
    let alive = true;
    async function refreshList() { try { const payload = await getPublicClass(token); if (alive && payload) setData(payload); } catch { /* Keep current selection during a temporary connection failure. */ } }
    const timer = window.setInterval(() => { if (!document.hidden) void refreshList(); }, 20000);
    window.addEventListener('focus', refreshList);
    return () => { alive = false; window.clearInterval(timer); window.removeEventListener('focus', refreshList); };
  }, [token]);
  useEffect(() => {
    if (!customReferenceFile) { setCustomReferencePreview(""); return; }
    const url = URL.createObjectURL(customReferenceFile);
    setCustomReferencePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [customReferenceFile]);
  useEffect(() => {
    if (!cartOpen) return;
    document.body.classList.add("order-cart-open");
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setCartOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.classList.remove("order-cart-open"); window.removeEventListener("keydown", closeOnEscape); };
  }, [cartOpen]);
  useEffect(() => {
    if (!customRequestOpen) return;
    document.body.classList.add("custom-request-open");
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") closeCustomRequest(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.classList.remove("custom-request-open"); window.removeEventListener("keydown", closeOnEscape); };
  }, [customRequestOpen]);
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
  const sortedChildren = useMemo(() => [...(data?.children || [])].sort((left, right) => russianNameCollator.compare(left.public_name.trim(), right.public_name.trim())), [data]);
  const editingExisting = Boolean(child?.orders?.some((order) => order.status !== "cancelled" && order.items.some((item) => Boolean(item.id && data?.catalog.some((entry) => entry.id === item.id)))));
  const selectedCatalogItems = useMemo(() => data?.catalog.filter((item) => selected.includes(item.id)) || [], [data, selected]);
  const customOrderItems = useMemo(() => child?.orders?.filter((order) => order.status !== "cancelled").flatMap((order) => order.items.filter((item) => item.type === "custom" || item.id?.startsWith("custom-request"))) || [], [child]);
  const total = useMemo(() => data?.catalog.filter((item) => selected.includes(item.id)).reduce((sum, item) => sum + Math.max(0, Number(item.price) - (withoutLamination.includes(item.id) ? 50 : 0)) + (servicePreferences[item.id]?.videoAddonRequested ? 500 : 0), 0) || 0, [data, selected, withoutLamination, servicePreferences]);
  const sections = useMemo(() => buildCatalogSections(data?.catalog || [], gender), [data, gender]);
  const prioritizedSections = useMemo(() => sections.map((section) => ({ ...section, items: [...section.items].sort((left, right) => Number(Boolean(right.popular)) - Number(Boolean(left.popular))) })), [sections]);
  const popularItems = useMemo(() => prioritizedSections.flatMap((section) => section.items.find((item) => item.popular) || []), [prioritizedSections]);
  const customServiceResults = useMemo(() => {
    const query = customServiceSearch.trim().toLocaleLowerCase("ru");
    if (!query) return data?.catalog || [];
    return (data?.catalog || []).filter((item) => `${item.name} ${item.category}`.toLocaleLowerCase("ru").includes(query));
  }, [customServiceSearch, data]);
  useEffect(() => {
    if (!sections.length) return;
    if (activeCategory !== "all" && !sections.some((section) => section.id === activeCategory)) setActiveCategory("all");
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
  useEffect(() => {
    if (step !== "services" || !("IntersectionObserver" in window) || !categoryCardsRef.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      setFiltersPinned(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    }, { threshold: 0 });
    observer.observe(categoryCardsRef.current);
    return () => observer.disconnect();
  }, [step]);
  function scrollToCategory(id: string) {
    setActiveCategory(id);
    const target = id === "all"
      ? document.querySelector<HTMLElement>("[data-catalog-section-list]")
      : Array.from(document.querySelectorAll<HTMLElement>("[data-catalog-section]"))
        .find((element) => element.dataset.catalogSection === id);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function toggle(id: string) {
    setSelected((items) => {
      if (items.includes(id)) { setLastRemovedId(id); setServicePreferences(current => { const next = {...current}; delete next[id]; return next; }); return items.filter((item) => item !== id); }
      setLastRemovedId(""); return [...items, id];
    });
  }
  function restoreLastRemoved() {
    if (!lastRemovedId) return;
    setSelected((items) => items.includes(lastRemovedId) ? items : [...items, lastRemovedId]);
    setLastRemovedId("");
  }
  function setLamination(id: string, withLamination: boolean) { setWithoutLamination((items) => withLamination ? items.filter((item) => item !== id) : items.includes(id) ? items : [...items, id]); }
  function openPreference(item: CatalogEntry) { setPreferenceItem(item); setPreferenceDraft(servicePreferences[item.id] || { comment: "", videoAddonRequested: false }); }
  function choosePreferenceVideo(file?: File) { if (!file) return; if (!file.type.startsWith("video/") || file.size > 120 * 1024 * 1024) { setError("Выберите видео не больше 120 МБ. Перед отправкой оно будет сжато."); return; } setError(""); setPreferenceDraft(value => ({...value, videoAddonRequested: true, videoFile: file, videoName: file.name})); }
  function savePreference() { if (!preferenceItem) return; const value = { ...preferenceDraft, comment: preferenceDraft.comment.trim().slice(0, 240) }; setServicePreferences(current => value.comment || value.videoAddonRequested ? {...current, [preferenceItem.id]: value} : Object.fromEntries(Object.entries(current).filter(([id]) => id !== preferenceItem.id))); setPreferenceItem(null); }
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
    const restoredPreferences = Object.fromEntries((order?.items || []).filter((item) => item.id && (item.parent_comment || item.video_addon_requested || item.animation_requested)).map((item) => [item.id, { comment: item.parent_comment || "", videoAddonRequested: Boolean(item.video_addon_requested || item.animation_requested), videoName: item.parent_video_name || "" }]));
    childOrigin.current = { scrollY: window.scrollY, childId: id };
    servicesEntry.current = crypto.randomUUID();
    servicesArmed.current = false;
    requestKey.current = crypto.randomUUID();
    serviceScrollTarget.current = restored[0] || "";
    setLastRemovedId("");
    setSelected([...new Set(restored)]); setWithoutLamination([...new Set(unprotected)]); setServicePreferences(restoredPreferences); setResult(null); setError("");
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
  function closeViewer() {
    setPreviewItem(null);
    if (!checkoutAfterViewer.current) return;
    checkoutAfterViewer.current = false;
    requestAnimationFrame(() => setCartOpen(true));
  }
  async function submit() {
    if (!childId || pending || (!selected.length && !editingExisting)) return;
    setPending(true); setError(""); setNotice(""); setUploadStatus("");
    try {
      if (!selected.length) {
        await cancelPublicOrder({ token, childId });
        setData(current => current ? {...current, children: current.children.map(item => item.id === childId ? {...item, orders: []} : item)} : current);
        setWithoutLamination([]); setServicePreferences({}); setNotice("Заявка удалена. Можно выбрать услуги заново."); restoreChildren(); return;
      }
      let order = await submitPublicOrder({
        token, childId, itemIds: selected,
        withoutLaminationIds: withoutLamination.filter((id) => selected.includes(id)), requestKey: requestKey.current, note: "",
        itemPreferences: Object.fromEntries(Object.entries(servicePreferences).filter(([id]) => selected.includes(id)).map(([id, value]) => [id, {comment: value.comment, videoAddonRequested: value.videoAddonRequested}])),
      });
      const videos = Object.entries(servicePreferences).filter(([id, value]) => selected.includes(id) && value.videoFile);
      for (let index = 0; index < videos.length; index += 1) {
        const [itemId, preference] = videos[index];
        setUploadStatus(`Сжимаем видео ${index + 1} из ${videos.length}…`);
        const optimized = await optimizeCatalogVideo(preference.videoFile!);
        if (optimized.size > 25 * 1024 * 1024) throw new Error("Видео не удалось уменьшить до 25 МБ. Обрежьте его или выберите более короткий ролик.");
        const extension = optimized.type.includes("webm") ? "webm" : optimized.type.includes("quicktime") ? "mov" : "mp4";
        const video = new File([optimized], `${preference.videoFile!.name.replace(/\.[^.]+$/, "")}.${extension}`, {type: optimized.type || preference.videoFile!.type});
        setUploadStatus(`Отправляем видео ${index + 1} из ${videos.length}…`);
        order = await attachPublicServiceVideo({token, childId, itemId, video});
      }
      setData(current => current ? {...current, children: current.children.map(item => item.id === childId ? {...item, orders: [{status: order.status, items: order.selected_items}]} : item)} : current);
      setResult(order); setSelected(order.selected_items.map((item) => item.id));
      setWithoutLamination(order.selected_items.filter((item) => item.comment === "Без ламинации (защиты)").map((item) => item.id));
      setServicePreferences(Object.fromEntries(order.selected_items.filter(item => item.parent_comment || item.video_addon_requested).map(item => [item.id, {comment: item.parent_comment || "", videoAddonRequested: Boolean(item.video_addon_requested), videoName: item.parent_video_name || ""}])));
      setStep("done");
    } catch (reason) { setError(humanError(reason)); }
    finally { setUploadStatus(""); setPending(false); }
  }
  function closeCustomRequest() { setCustomRequestOpen(false); setCustomReferenceFile(null); setCustomReferenceServiceId(""); setCustomServiceSearch(""); }
  function chooseCustomReferenceFile(file?: File) { if (!file) return; if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError("Прикрепите JPG, PNG или WebP не больше 5 МБ."); return; } setError(""); setCustomReferenceFile(file); }
  async function submitCustomRequest(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!childId || pending) return; const message = String(new FormData(event.currentTarget).get("message") || "").trim(); if (message.length < 3 && !customReferenceFile && !customReferenceServiceId) { setError("Опишите идею или прикрепите скрин либо услугу из каталога."); return; } setPending(true); setError(""); try { const order = await submitPublicCustomRequest({ token, childId, message, requestKey: crypto.randomUUID(), catalogItemId: customReferenceServiceId || undefined, referenceFile: customReferenceFile }); setData(current => current ? {...current, children: current.children.map(item => item.id === childId ? {...item, orders: [{status: order.status, items: order.selected_items}]} : item)} : current); closeCustomRequest(); setResult(order); setStep("done"); } catch (reason) { setError(humanError(reason)); } finally { setPending(false); } }
  function chooseAnotherChild() { requestKey.current = crypto.randomUUID(); setResult(null); setSelected([]); setWithoutLamination([]); setServicePreferences({}); setChildId(""); setError(""); setPreviewItem(null); setStep("child"); }
  function orderLink(publicToken: string) { return `${window.location.origin}${import.meta.env.BASE_URL}order/${publicToken}`; }
  function renderCard(item: CatalogEntry, previewOnly = false) { return <ServiceCard key={item.id} item={item} selected={selected.includes(item.id)} related={previewOnly} withLamination={!withoutLamination.includes(item.id)} onOpen={() => setPreviewItem(item)} onToggle={() => toggle(item.id)} onLaminationChange={previewOnly ? undefined : (value) => setLamination(item.id, value)} onPreference={previewOnly ? undefined : () => openPreference(item)} />; }
  if (loading) return <PublicLoadingScreen />;
  if (error && !data) return <main className="public-page"><section className="public-error"><div className="error-illustration">!</div><h1>Ссылка недоступна</h1><p>{error}</p><span>Попросите учителя отправить актуальную ссылку.</span></section></main>;
  if (!data) return null;
  return <main className="public-page"><div className="public-shell"><header className="public-header"><div className="public-logo"><span className="brand-mark">KZ</span><div><strong>Khan Zama</strong><small>Школьная фотография</small></div></div><span className="step-indicator">{step === "child" ? "Шаг 1 из 2" : step === "services" ? "Шаг 2 из 2" : "Готово"}</span></header>
    <ParentIntro watched={introClosed} onComplete={() => setIntroClosed(true)} />
    {step === "child" && notice && <div className="public-inline-notice"><Notice kind="info">{notice}</Notice></div>}
    {step === "child" && <section className="public-content" id="public-catalog-start"><span className="eyebrow">{data.school.name} · {data.class.name}</span><h1>{data.class.photo_session_name}</h1><p className="public-lead">Выберите своего ребёнка</p>{!sortedChildren.length ? <Notice kind="info">Список детей пока не добавлен. Обратитесь к учителю.</Notice> : <div className="children-grid">{sortedChildren.map((item, index) => <button className={`child-choice ${childId === item.id ? "is-current" : ""}`} data-child-id={item.id} aria-pressed={childId === item.id} key={item.id} onClick={() => openServices(item.id)}><span className={`avatar avatar-${index % 3}`}><UserRound /></span><span className="child-choice-copy"><strong>{item.public_name}</strong><small>{item.orders?.length ? "Выбрал/а: " + item.orders.flatMap(order => order.items.map(service => `${service.name}${(service.quantity || 1) > 1 ? ` × ${service.quantity}` : ""}`)).join(", ") : "Пока без заявки"}</small></span><span className="child-order-previews">{item.orders?.flatMap(order => order.items).slice(0, 2).map((service, index) => { const named = data.catalog.filter(entry => entry.name === service.name); const image = data.catalog.find(entry => entry.id === service.id)?.preview_url || (named.length === 1 ? named[0].preview_url : "") || service.preview_url; return image ? <img key={`${service.id || service.name}-${index}`} src={image} alt={service.name} loading="lazy" onError={event => { const image = event.currentTarget; const named = data.catalog.filter(entry => entry.name === service.name); const fallback = named.length === 1 ? named[0].preview_url : ""; if (fallback && image.getAttribute("src") !== fallback) image.src = fallback; }} /> : null; })}</span></button>)}</div>}{childId && <div className="child-catalog-entry"><button className="button button-primary" onClick={() => openServices(childId)}>Открыть каталог фотографий</button></div>}<div className="privacy-note">Видео можно посмотреть по желанию. Каталог доступен сразу.</div></section>}
    {step === "services" && <section className="public-content service-step" id="public-catalog-start">
      <button className="service-back-floating" type="button" aria-label="Назад к списку детей" onClick={closeServices}><ArrowLeft size={20} /><span>Назад</span></button>
      <span className="eyebrow">{data.school.name} · {data.class.name}</span><h1>{child?.public_name}</h1>
      {error && <Notice kind="error">{error}</Notice>}
      {prioritizedSections.length > 0 && <div className="catalog-category-cards" ref={categoryCardsRef} aria-label="Категории услуг">
        {prioritizedSections.map((section, index) => {
          const preferredGender = index % 2 === 0 ? "girls" : "boys";
          const dragonVideo = section.id === "video" ? section.items.find((item) => /дракон/i.test(item.name) && item.preview_url) : undefined;
          const coverItem = dragonVideo || section.items.find((item) => item.gender === preferredGender && item.preview_url) || section.items.find((item) => item.preview_url);
          return <button type="button" className="catalog-category-card" key={section.id} aria-label={`Перейти к категории ${section.title}`} onClick={() => scrollToCategory(section.id)}>
            <span className="catalog-category-media">{coverItem?.preview_video_url
              ? <video src={catalogMediaUrl(coverItem.preview_video_url)} poster={coverItem.preview_url || undefined} aria-label={`Беззвучное видео-превью: ${coverItem.name}`} autoPlay muted loop playsInline preload="metadata" onPlay={(event) => { event.currentTarget.muted = true; event.currentTarget.volume = 0; }} />
              : coverItem?.preview_url ? <img src={coverItem.preview_url} alt="" loading="lazy" decoding="async" /> : <ServiceIcon type={section.items[0]?.type || "photo"} />}</span>
            <span className="catalog-category-copy"><strong>{section.title}</strong><small>{serviceCountLabel(section.items.length)}</small></span>
          </button>;
        })}
      </div>}
      <button type="button" className="catalog-custom-request-card" onClick={() => { setError(""); setCustomReferenceFile(null); setCustomReferenceServiceId(""); setCustomServiceSearch(""); setCustomRequestOpen(true); }}>
        <img src={`${import.meta.env.BASE_URL}images/custom-photo-request-banner.webp`} alt="" loading="lazy" decoding="async" />
        <span className="catalog-custom-request-copy"><MessageSquarePlus aria-hidden="true"/><strong>Не нашли нужный образ?</strong><small>Опишите идею — мы подберём вариант для {child?.public_name}.</small><b>Оставить заявку</b></span>
      </button>
      {popularItems.length > 0 && <section className="catalog-popular-section" aria-label="Популярные услуги"><h2>Популярное</h2><p>Лучшие варианты — по одной услуге из каждой категории.</p><div className="service-list">{popularItems.map((item) => renderCard(item))}</div></section>}
      {data.catalog.length > 0 && <div className={`catalog-sticky-filters${filtersPinned ? " is-pinned" : ""}`}>
        <div className="catalog-gender-tabs" role="group" aria-label="Категория ребёнка">
          <button className={gender === "all" ? "active" : ""} onClick={() => setGender("all")}>Все</button>
          <button className={gender === "boys" ? "active" : ""} onClick={() => setGender("boys")}>Мальчики</button>
          <button className={gender === "girls" ? "active" : ""} onClick={() => setGender("girls")}>Девочки</button>
        </div>
        <nav className="catalog-jump-nav" aria-label="Быстрый переход по категориям">
          <button type="button" className={activeCategory === "all" ? "active" : ""} aria-current={activeCategory === "all" ? "true" : undefined} onClick={() => scrollToCategory("all")}>Все категории</button>
          {prioritizedSections.map((section) => <button type="button" key={section.id} className={activeCategory === section.id ? "active" : ""} aria-current={activeCategory === section.id ? "true" : undefined} onClick={() => scrollToCategory(section.id)}>{section.title}</button>)}
        </nav>
      </div>}
      <div className="catalog-section-list" data-catalog-section-list>{prioritizedSections.map((section) => <section className="service-group catalog-section" data-catalog-section={section.id} key={section.id}><h2>{section.title}</h2>{section.notice && <div className="catalog-video-notice"><Video size={20}/><span>{section.notice}</span></div>}{section.items.length > 0 && <div className="service-list">{section.items.map((item) => renderCard(item))}</div>}{section.relatedItems?.length ? <><h3 className="catalog-related-title">{section.relatedTitle}</h3><div className="service-list">{section.relatedItems.map((item) => renderCard(item, true))}</div></> : null}</section>)}</div>
      {!data.catalog.length && <Notice kind="info">Каталог пуст.</Notice>}
      {(selected.length > 0 || customOrderItems.length > 0) && <OrderCart items={selectedCatalogItems} customItems={customOrderItems} total={total} open={cartOpen} pending={pending} editing={editingExisting} withoutLamination={withoutLamination} preferences={servicePreferences} onOpen={() => setCartOpen(true)} onClose={() => setCartOpen(false)} onRemove={toggle} onLaminationChange={setLamination} onPreference={openPreference} onSubmit={() => void submit()} />}
    </section>}
    {step === "services" && selected.length === 0 && editingExisting && <div className="empty-order-dock"><span>Вы убрали последнюю услугу. Удалить заявку целиком?</span><div className="empty-order-actions"><button className="button button-secondary" disabled={pending} onClick={restoreLastRemoved}>Нет, вернуть</button><button className="button button-danger" disabled={pending} onClick={() => void submit()}>{pending && <LoaderCircle className="spin" size={18} />}Да, удалить</button></div></div>}
    {previewItem && <CatalogViewer items={data.catalog} initialId={previewItem.id} initialGender={gender} selected={selected} onToggle={toggle} onCheckout={() => { checkoutAfterViewer.current = true; }} onClose={closeViewer} />}
    {preferenceItem && <Modal title={`Пожелание к «${preferenceItem.name}»`} className="service-preference-modal" onClose={() => setPreferenceItem(null)}><div className="service-preference-form"><p>Уточните оформление. Пожелание и прикреплённое видео увидят студия и учитель.</p><label className={`service-animation-toggle${preferenceDraft.videoAddonRequested ? " active" : ""}`}><input type="checkbox" checked={preferenceDraft.videoAddonRequested} onChange={(event) => { const checked = event.currentTarget.checked; setPreferenceDraft(value => ({...value, videoAddonRequested: checked, videoFile: checked ? value.videoFile : undefined, videoName: checked ? value.videoName : undefined})); }}/><Video/><span><strong>Оживление фото · +500 ₽</strong><small>Прикрепить своё видео, которое будет открываться с фотографии.</small></span></label>{preferenceDraft.videoAddonRequested && <label className="service-video-file"><span><Video size={18}/>Прикрепить видео для оживления</span><input type="file" accept="video/mp4,video/webm,video/quicktime,video/*" onChange={(event) => choosePreferenceVideo(event.currentTarget.files?.[0])}/><small>{preferenceDraft.videoName || "До 120 МБ — перед отправкой видео автоматически сожмётся"}</small></label>}<div className="service-ai-video-note"><Sparkles/><span><strong>Интервью — 800 ₽, ИИ‑видео — 1 200 ₽</strong><small>Это отдельные услуги в каталоге, они не относятся к обычному оживлению фото.</small></span></div><label>Короткий комментарий<textarea maxLength={240} rows={3} value={preferenceDraft.comment} onChange={(event) => setPreferenceDraft(value => ({...value, comment: event.currentTarget.value}))} placeholder="Например: добавить мяч в руки, интервью не за партой…"/><small>{preferenceDraft.comment.length}/240</small></label><div className="form-actions"><button type="button" className="button button-secondary" onClick={() => setPreferenceItem(null)}>Отмена</button><button type="button" className="button button-primary" onClick={savePreference}>Сохранить</button></div></div></Modal>}
    {uploadStatus && <div className="media-upload-status" role="status"><LoaderCircle className="spin" size={18}/>{uploadStatus}</div>}
    {customRequestOpen && <Modal title="Подобрать индивидуальный образ" className="custom-request-modal" onClose={closeCustomRequest}><form className="form-stack custom-request-form" onSubmit={submitCustomRequest}><p>Опишите идею и, если хотите, приложите скрин или выберите похожую услугу. Всё сохранится в карточке ребёнка.</p><label>Что вы хотите для {child?.public_name}?<textarea name="message" minLength={3} maxLength={1000} rows={4} autoFocus placeholder="Например: сын хочет фото в образе пожарного…"/></label><div className="custom-request-attachments"><label className="custom-request-file"><span><ImagePlus size={18}/>Скрин или референс</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseCustomReferenceFile(event.currentTarget.files?.[0])}/><small>JPG, PNG или WebP до 5 МБ</small></label>{customReferencePreview && <div className="custom-request-preview"><img src={customReferencePreview} alt="Прикреплённый референс"/><button type="button" aria-label="Убрать прикреплённый скрин" onClick={() => setCustomReferenceFile(null)}><X size={16}/></button></div>}<fieldset className="custom-request-service"><legend>Похожая услуга из каталога</legend><label className="custom-request-search">Поиск услуги<input type="search" value={customServiceSearch} onChange={(event) => setCustomServiceSearch(event.currentTarget.value)} placeholder="Например: дракон, футбол…"/></label><div className="custom-request-service-list" role="radiogroup" aria-label="Услуга из каталога"><button type="button" role="radio" aria-checked={!customReferenceServiceId} className={`custom-request-service-card custom-request-service-empty${!customReferenceServiceId ? " selected" : ""}`} onClick={() => setCustomReferenceServiceId("")}><span><X size={19}/></span><strong>Без услуги</strong><small>Только текст или скрин</small></button>{customServiceResults.map((item) => <button type="button" role="radio" aria-checked={customReferenceServiceId === item.id} className={`custom-request-service-card${customReferenceServiceId === item.id ? " selected" : ""}`} key={item.id} onClick={() => setCustomReferenceServiceId(item.id)}>{item.preview_url ? <img src={item.preview_url} alt="" loading="lazy" decoding="async"/> : <span><ServiceIcon type={item.type}/></span>}<span className="custom-request-service-copy"><strong>{item.name}</strong><small>{item.category || "Услуга"}</small></span>{customReferenceServiceId === item.id && <CheckCircle2 className="custom-request-service-check" aria-hidden="true"/>}</button>)}</div>{!customServiceResults.length && <p className="custom-request-service-empty-state">Ничего не найдено. Попробуйте другое слово.</p>}</fieldset></div><div className="form-actions"><button className="button button-secondary" type="button" disabled={pending} onClick={closeCustomRequest}>Отмена</button><button className="button button-primary" type="submit" disabled={pending}>{pending && <LoaderCircle className="spin" size={17}/>}Отправить запрос</button></div></form></Modal>}
    {step === "done" && result && <section className="success-screen"><div className="success-mark"><CheckCircle2 /></div><h1>{result.duplicate ? "Заявка уже была отправлена" : "Заявка сохранена"}</h1><span className="success-pill">Прикреплена к карточке ребёнка</span><div className="order-number">Номер заявки <strong>{result.order_number}</strong></div><div className="confirmation-card"><div><span>Ребёнок</span><strong>{result.child_name}</strong></div><div><span>Класс</span><strong>{result.class_name}</strong></div><div><span>Услуги</span><strong>{result.selected_items.map((item) => `${item.name}${(item.quantity || 1) > 1 ? ` × ${item.quantity}` : ""}${item.comment ? ` (${item.comment})` : ""}`).join(", ")}</strong></div><div><span>Итого</span><strong>{money(result.total_amount)}</strong></div></div><div className="success-items">{result.selected_items.map((item) => <div className="success-item" key={item.id}>{item.preview_url ? <img src={item.preview_url} alt="" loading="lazy" decoding="async" /> : <ServiceIcon type={item.type} />}<span>{item.name}{(item.quantity || 1) > 1 ? ` × ${item.quantity}` : ""}</span><strong>{money(item.price * (item.quantity || 1))}</strong></div>)}</div><p>Заявка сохранена в карточке ребёнка. Отправлять её в WhatsApp не нужно.</p><div className="success-actions">{import.meta.env.VITE_CRM_MODE === "true" && <a className="button button-primary" href={orderLink(result.public_token)}>Открыть мой заказ</a>}<button className="button button-secondary" onClick={() => setStep("services")}><ArrowLeft size={18}/>Назад к выбору</button>{data.children.length > 1 && <button className="button button-secondary" onClick={chooseAnotherChild}>Выбрать другого ребёнка</button>}<button className="button button-primary button-wide" onClick={chooseAnotherChild}>Готово</button></div></section>}
  </div></main>;
}
