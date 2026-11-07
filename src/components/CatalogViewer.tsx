import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, Check, Image as ImageIcon, Plus, X, SlidersHorizontal, ChevronUp, ChevronDown, Scan } from "lucide-react";
import { buildCatalogSections, type CatalogGender } from "../lib/catalogSections";
import { catalogMediaUrl } from "../lib/mediaUrl";
import { money } from "../lib/helpers";
import "./catalog-viewer.css";

export type ViewerItem = {
  id: string; name: string; price: number; category: string; gender: string; type: string;
  preview_url: string; original_url?: string; preview_video_url: string; description?: string; short_description?: string;
  parent_preview_mode?: "auto" | "print" | "digital";
};

export function viewerItems(items: ViewerItem[], gender: CatalogGender, category: string) {
  const scoped = items.filter(item => category === "all" || item.category === category);
  return [...new Map(buildCatalogSections(scoped, gender).flatMap(section => section.items).map(item => [item.id, item])).values()];
}

function GalleryPhoto({ item }: { item: ViewerItem }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return <figure className={`service-gallery-photo ${item.category === "Фото с видео" ? "is-landscape" : ""}`}>
    {failed ? <div className="service-gallery-no-media" role="alert"><p>Фото не загрузилось.</p><button className="button button-secondary" type="button" onClick={() => { setAttempt(value => value + 1); setFailed(false); }}>Повторить загрузку фото</button></div>
      : <img key={attempt} src={item.original_url || item.preview_url} alt={item.name} loading="lazy" decoding="async" onError={() => setFailed(true)} />}
    <figcaption>{item.parent_preview_mode === "digital" ? "Цифровое фото" : "Распечатка А4"}</figcaption>
  </figure>;
}

function PhoneVideo({ item, active }: { item: ViewerItem; active: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!active) { video?.pause(); return; }
    void video?.play().catch(() => undefined);
  }, [active]);
  return <figure className="service-gallery-phone">
    <div className="service-gallery-phone-screen">
      {active ? <video ref={ref} autoPlay muted loop playsInline preload="metadata" poster={item.preview_url || undefined}
        src={catalogMediaUrl(item.preview_video_url)} aria-label={`Видео услуги ${item.name}`}
        onError={() => setFailed(true)} onLoadedData={() => setFailed(false)} />
        : <img src={item.preview_url} alt={`Превью видео: ${item.name}`} loading="lazy" />}
    </div>
    {failed && <p role="alert">Видео не загрузилось. <button type="button" onClick={() => { setFailed(false); ref.current?.load(); }}>Повторить</button></p>}
  </figure>;
}

type Props = {
  items: ViewerItem[]; initialId: string; initialGender?: CatalogGender; initialCategory?: string;
  immersive?: boolean; readOnly?: boolean; selected: string[]; onToggle: (id: string) => void; onClose: () => void;
};

/** An overlay owns one history entry; the source page stays mounted underneath it. */
export function CatalogViewer({ items, initialId, initialGender = "all", initialCategory = "all", selected, onToggle, onClose, immersive = false, readOnly = false }: Props) {
  const [gender, setGender] = useState<CatalogGender>(() => viewerItems(items, initialGender, initialCategory).some(item => item.id === initialId) ? initialGender : "all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [fitted, setFitted] = useState(false);
  const [category, setCategory] = useState(initialCategory);
  const [activeId, setActiveId] = useState(initialId);
  const categories = useMemo(() => [...new Set(items.map(item => item.category).filter(Boolean))], [items]);
  const visible = useMemo(() => viewerItems(items, gender, category), [items, gender, category]);
  const root = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const scrollScope = useRef({ key: `${gender}:${category}`, target: initialId as string | undefined });
  const origin = useRef<HTMLElement | null>(null);
  const scrollRestoration = useRef(window.history.scrollRestoration);
  const restoreFrame = useRef<number | undefined>(undefined);
  const navigate = useNavigate();
  const location = useLocation();
  const entry = useRef(crypto.randomUUID());
  const entered = useRef(false);
  const armed = useRef(false);
  const closeCallback = useRef(onClose);
  closeCallback.current = onClose;

  useEffect(() => {
    if (entered.current) return;
    entered.current = true;
    navigate({ pathname: location.pathname, search: location.search, hash: location.hash }, {
      state: { ...location.state, catalogViewer: entry.current }, preventScrollReset: true,
    });
  }, [navigate, location]);
  useEffect(() => {
    if (location.state?.catalogViewer === entry.current) armed.current = true;
    else if (armed.current) closeCallback.current();
  }, [location]);
  function close() {
    if (location.state?.catalogViewer === entry.current) navigate(-1);
    else closeCallback.current();
  }

  useLayoutEffect(() => {
    if (restoreFrame.current !== undefined) cancelAnimationFrame(restoreFrame.current);
    origin.current = document.activeElement as HTMLElement | null;
    const y = window.scrollY;
    const bodyStyle = document.body.getAttribute("style");
    const app = document.getElementById("root");
    const inert = app?.inert;
    window.history.scrollRestoration = "manual";
    if (app) app.inert = true;
    Object.assign(document.body.style, { position: "fixed", top: `-${y}px`, left: "0", right: "0", overflow: "hidden" });
    root.current?.focus({ preventScroll: true });
    return () => {
      if (app) app.inert = inert || false;
      if (bodyStyle === null) document.body.removeAttribute("style");
      else document.body.setAttribute("style", bodyStyle);
      window.scrollTo(0, y);
      origin.current?.focus({ preventScroll: true });
      // A popstate can restore the old entry after React's layout cleanup.
      restoreFrame.current = requestAnimationFrame(() => {
        window.scrollTo(0, y);
        window.history.scrollRestoration = scrollRestoration.current;
      });
    };
  }, []);

  useLayoutEffect(() => {
    const key = `${gender}:${category}`;
    if (scrollScope.current.key !== key) scrollScope.current = { key, target: visible[0]?.id };
    const targetId = scrollScope.current.target;
    const target = Array.from(scroller.current?.children || []).find(node => (node as HTMLElement).dataset.itemId === targetId) as HTMLElement | undefined;
    if (scroller.current) scroller.current.scrollTop = target?.offsetTop || 0;
    if (targetId) setActiveId(targetId);
  }, [visible, gender, category]);

  const activeIndex = Math.max(0, visible.findIndex(item => item.id === activeId));
  function move(index: number) {
    const target = scroller.current?.children[index] as HTMLElement | undefined;
    if (target && scroller.current) {
      scroller.current.scrollTo({ top: target.offsetTop, behavior: "instant" });
      setActiveId(visible[index].id);
    }
  }
  function syncActive() {
    const container = scroller.current;
    if (!container) return;
    const line = container.scrollTop + container.clientHeight * .3;
    const slides = Array.from(container.children) as HTMLElement[];
    const current = slides.find(slide => slide.offsetTop + slide.offsetHeight > line);
    if (current?.dataset.itemId) setActiveId(current.dataset.itemId);
  }

  return createPortal(<div ref={root} className={`service-gallery ${immersive ? "service-gallery-presentation" : "service-gallery-ordering"} ${fitted ? "is-fitted" : ""}`} role="dialog" aria-modal="true" aria-label="Просмотр услуг" tabIndex={-1}
    onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
      if (event.key === "Tab") {
        const controls = Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]') || []).filter(node => node.getClientRects().length > 0);
        const first = controls[0]; const last = controls.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root.current)) { event.preventDefault(); first?.focus(); }
      }
      if ((event.target as HTMLElement).closest('button, video')) return;
      if (event.key === "ArrowDown" || event.key === "PageDown") { event.preventDefault(); move(Math.min(visible.length - 1, activeIndex + 1)); }
      if (event.key === "ArrowUp" || event.key === "PageUp") { event.preventDefault(); move(Math.max(0, activeIndex - 1)); }
    }}>
    <header className="service-gallery-header">
      <div className="service-gallery-toolbar"><strong>Каталог услуг</strong><span aria-live="polite">{visible.length ? `${activeIndex + 1} / ${visible.length}` : "0 услуг"}</span>
        <button type="button" className="presentation-filter-toggle" aria-expanded={filtersOpen} aria-controls="viewer-gender viewer-categories" onClick={() => setFiltersOpen(value => !value)}><SlidersHorizontal size={15} /><span>Фильтры</span>{filtersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
        {immersive && <button type="button" className="presentation-fit-toggle" aria-pressed={fitted} onClick={() => setFitted(value => !value)}><Scan size={16} />{fitted ? "Заполнить экран" : "Фото целиком"}</button>}
        {!immersive && <><button type="button" aria-label="Предыдущая услуга" disabled={!visible.length || activeIndex === 0} onClick={() => move(activeIndex - 1)}><ArrowUp size={20} /></button>
        <button type="button" aria-label="Следующая услуга" disabled={!visible.length || activeIndex === visible.length - 1} onClick={() => move(activeIndex + 1)}><ArrowDown size={20} /></button></>}
        <button type="button" aria-label="Закрыть просмотр" onClick={close}><X size={22} /></button>
      </div>
      <div id="viewer-gender" hidden={!filtersOpen} className="service-gallery-filters" role="group" aria-label="Для кого услуга">
        {([['all', 'Все'], ['boys', 'Мальчикам'], ['girls', 'Девочкам']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={gender === value} onClick={() => setGender(value)}>{label}</button>)}
      </div>
      <div id="viewer-categories" hidden={!filtersOpen} className="service-gallery-filters" role="group" aria-label="Категория услуги">
        <button type="button" aria-pressed={category === "all"} onClick={() => setCategory("all")}>Все категории</button>
        {categories.map(value => <button key={value} type="button" aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</button>)}
      </div>
    </header>
    {immersive && <nav className="presentation-nav" aria-label="Перелистывание услуг"><button type="button" aria-label="Предыдущая услуга" disabled={!visible.length || activeIndex === 0} onClick={() => move(activeIndex - 1)}><ArrowUp size={22} /></button><button type="button" aria-label="Следующая услуга" disabled={!visible.length || activeIndex === visible.length - 1} onClick={() => move(activeIndex + 1)}><ArrowDown size={22} /></button></nav>}
    <div ref={scroller} className="service-gallery-scroll" onScroll={syncActive}>
      {visible.map((item, index) => <article key={item.id} data-item-id={item.id} className="service-gallery-slide" aria-label={item.name}>
        <div className="service-gallery-heading"><div><h2>{item.name}</h2><p>{item.category}</p></div><strong>{money(item.price)}</strong></div>
        <div className={`service-gallery-media ${item.preview_video_url ? "has-video" : ""}`}>
          {item.preview_url ? <GalleryPhoto item={item} />
            : !item.preview_video_url && <div className="service-gallery-no-media"><ImageIcon size={40} /><p>Пример результата пока не добавлен.</p></div>}
          {item.preview_video_url && <PhoneVideo item={item} active={item.id === activeId} />}
        </div>
        <footer className="service-gallery-footer"><span>{index + 1} / {visible.length}<small>{index < visible.length - 1 ? "Листайте вверх — следующая услуга" : "Последняя услуга"}</small></span>
          {!readOnly && <button type="button" className={`button ${selected.includes(item.id) ? "button-secondary" : "button-primary"}`} aria-pressed={selected.includes(item.id)} onClick={() => onToggle(item.id)}>
            {selected.includes(item.id) ? <Check size={18} /> : <Plus size={18} />}{selected.includes(item.id) ? "Добавлено" : "Добавить к заказу"}
          </button>}</footer>
      </article>)}
      {!visible.length && <div className="service-gallery-empty"><h2>Нет услуг с такими фильтрами</h2><button className="button button-secondary" onClick={() => { setCategory("all"); setGender("all"); }}>Показать все услуги</button></div>}
    </div>
  </div>, document.body);
}
