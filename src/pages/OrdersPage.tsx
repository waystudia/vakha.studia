import { ArrowLeft, Building2, ChevronRight, ClipboardList, Download, GraduationCap, Image as ImageIcon, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { EmptyState, Loader, Notice } from "../components/ui";
import { fullChildName, downloadCsv, formatDateTime, humanError, money, orderStatusLabels } from "../lib/helpers";
import { loadOrdersWorkspace, updateOrderStatus } from "../lib/repository";
import { supabase } from "../lib/supabase";
import type { OrderStatus, OrdersWorkspace, ParentOrder } from "../lib/types";

const emptyWorkspace: OrdersWorkspace = { schools: [], classes: [], orders: [] };

function searchableOrder(order: ParentOrder) {
  return [
    order.order_number,
    fullChildName(order.child),
    order.class?.school?.name,
    order.class?.name,
    ...order.selected_items.map((item) => item.name),
  ].filter(Boolean).join(" ").toLocaleLowerCase("ru");
}

function orderedServiceCount(orders: ParentOrder[]) {
  return orders.reduce((total, order) => total + order.selected_items.reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0), 0);
}

function countLabel(count: number, one: string, few: string, many: string) {
  const mod100 = count % 100;
  const mod10 = count % 10;
  const word = mod100 >= 11 && mod100 <= 14 ? many : mod10 === 1 ? one : mod10 >= 2 && mod10 <= 4 ? few : many;
  return `${count} ${word}`;
}

export function OrdersPage() {
  const [workspace, setWorkspace] = useState<OrdersWorkspace>(emptyWorkspace);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"all" | OrderStatus>("all");
  const [search, setSearch] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [classId, setClassId] = useState("");
  const [referenceUrls, setReferenceUrls] = useState<Record<string, string>>({});

  async function refresh() {
    setLoading(true);
    try {
      setWorkspace(await loadOrdersWorkspace());
    } catch (reason) {
      setError(humanError(reason));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    let active = true;
    const paths = [...new Set(workspace.orders.flatMap((order) => order.selected_items.map((item) => item.reference_path).filter((path): path is string => Boolean(path))))];
    if (!paths.length) { setReferenceUrls({}); return; }
    void Promise.all(paths.map(async (path) => {
      const { data, error } = await supabase.storage.from("parent-request-references").createSignedUrl(path, 60 * 60);
      return error || !data?.signedUrl ? [path, ""] as const : [path, data.signedUrl] as const;
    })).then((entries) => { if (active) setReferenceUrls(Object.fromEntries(entries.filter(([, url]) => url))); });
    return () => { active = false; };
  }, [workspace.orders]);

  const normalizedSearch = search.trim().toLocaleLowerCase("ru");
  const filteredOrders = useMemo(() => workspace.orders.filter((order) =>
    order.status !== "cancelled"
    && (status === "all" || order.status === status)
    && (!normalizedSearch || searchableOrder(order).includes(normalizedSearch))), [workspace.orders, status, normalizedSearch]);
  // Orders from a school that has since been archived must never inflate the
  // active dashboard total. They remain in the database for history, but the
  // active hierarchy deliberately contains only current schools.
  const activeProjectOrders = useMemo(() => {
    const activeSchoolIds = new Set(workspace.schools.map((school) => school.id));
    return filteredOrders.filter((order) => Boolean(order.class?.school_id && activeSchoolIds.has(order.class.school_id)));
  }, [filteredOrders, workspace.schools]);
  const selectedSchool = workspace.schools.find((school) => school.id === schoolId);
  const selectedClass = workspace.classes.find((schoolClass) => schoolClass.id === classId);
  const schoolClasses = workspace.classes.filter((schoolClass) => schoolClass.school_id === schoolId);
  const visibleOrders = filteredOrders.filter((order) => (!schoolId || order.class?.school_id === schoolId) && (!classId || order.class_id === classId));
  const visibleSchools = workspace.schools.filter((school) => {
    if (!normalizedSearch) return true;
    if (`${school.name} ${school.city}`.toLocaleLowerCase("ru").includes(normalizedSearch)) return true;
    return activeProjectOrders.some((order) => order.class?.school_id === school.id);
  });

  async function changeStatus(order: ParentOrder, next: OrderStatus) {
    try {
      await updateOrderStatus(order.id, next);
      setWorkspace((current) => ({ ...current, orders: current.orders.map((item) => item.id === order.id ? { ...item, status: next } : item) }));
    } catch (reason) {
      setError(humanError(reason));
    }
  }

  function exportAll() {
    const rows: unknown[][] = [["Школа", "Класс", "Ребёнок", "Номер заявки", "Выбранные услуги", "Сумма", "Статус", "Дата заявки", "Комментарий"]];
    visibleOrders.forEach((order) => rows.push([
      order.class?.school?.name,
      order.class?.name,
      fullChildName(order.child),
      order.order_number,
      order.selected_items.map((item) => `${item.name}${(item.quantity || 1) > 1 ? ` × ${item.quantity}` : ""}${item.comment ? ` (${item.comment})` : ""}`).join(", "),
      order.total_amount,
      orderStatusLabels[order.status],
      formatDateTime(order.created_at),
      order.parent_note,
    ]));
    downloadCsv("vakha_studio_заявки.csv", rows);
  }

  function goBack() {
    if (classId) setClassId("");
    else setSchoolId("");
  }

  return <div className="page orders-page">
    <header className="page-header orders-header">
      <div>
        <span className="eyebrow">ЗАЯВКИ РОДИТЕЛЕЙ</span>
        <h1>Заявки</h1>
        <p>Выберите проект, класс, затем откройте карточки детей и их услуги.</p>
      </div>
      <div className="inline-actions">
        <Link className="button button-primary" to="/admin/schools"><Download size={18}/>Экспорт в CRM</Link>
        <button className="button button-secondary" disabled={!visibleOrders.length} onClick={exportAll}><Download size={18}/>CSV</button>
      </div>
    </header>

    {error && <Notice kind="error">{error}</Notice>}
    <div className="filters orders-filters">
      <input aria-label="Поиск заявок" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ребёнок, услуга, школа или номер"/>
      <select aria-label="Статус заявок" value={status} onChange={(event) => setStatus(event.target.value as "all" | OrderStatus)}>
        <option value="all">Все статусы</option>
        {Object.entries(orderStatusLabels).filter(([value]) => value !== "cancelled").map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select>
    </div>

    {(schoolId || classId) && <nav className="orders-breadcrumbs" aria-label="Навигация по заявкам">
      <button type="button" onClick={goBack}><ArrowLeft size={17}/><span>Назад</span></button>
      <div>
        <small>{selectedSchool?.name}</small>
        <strong>{selectedClass ? `Класс ${selectedClass.name}` : "Классы проекта"}</strong>
      </div>
    </nav>}

    {loading ? <Loader label="Загружаем заявки…"/> : !schoolId ? <section aria-labelledby="orders-projects-title">
      <div className="orders-section-heading">
        <div><span>Шаг 1</span><h2 id="orders-projects-title">Проекты и школы</h2></div>
        <strong className="orders-total" aria-label={`${countLabel(activeProjectOrders.length, "активная заявка", "активные заявки", "активных заявок")}, ${countLabel(orderedServiceCount(activeProjectOrders), "заказ", "заказа", "заказов")}`}><span>{countLabel(activeProjectOrders.length, "заявка", "заявки", "заявок")}</span><span>{countLabel(orderedServiceCount(activeProjectOrders), "заказ", "заказа", "заказов")}</span></strong>
      </div>
      {!visibleSchools.length ? <EmptyState icon={<Building2/>} title="Проекты не найдены" text="Измените поиск или фильтр статуса."/> : <div className="order-project-grid">
        {visibleSchools.map((school) => {
          const classes = workspace.classes.filter((item) => item.school_id === school.id);
          const orders = activeProjectOrders.filter((order) => order.class?.school_id === school.id);
          return <button type="button" className="order-project-card" key={school.id} onClick={() => { setSchoolId(school.id); setClassId(""); }}>
            <span className="order-project-icon"><Building2/></span>
            <span className="order-project-copy"><strong>{school.name}</strong><small>{school.city || "Город не указан"}</small></span>
            <span className="order-project-stats"><span><b>{classes.length}</b> {countLabel(classes.length, "класс", "класса", "классов").replace(/^\d+ /, "")}</span><span><b>{orders.length}</b> {countLabel(orders.length, "заявка", "заявки", "заявок").replace(/^\d+ /, "")}</span><span><b>{orderedServiceCount(orders)}</b> {countLabel(orderedServiceCount(orders), "заказ", "заказа", "заказов").replace(/^\d+ /, "")}</span></span>
            <ChevronRight aria-hidden="true"/>
          </button>;
        })}
      </div>}
    </section> : !classId ? <section aria-labelledby="orders-classes-title">
      <div className="orders-section-heading">
        <div><span>Шаг 2</span><h2 id="orders-classes-title">Классы</h2></div>
        <strong className="orders-total"><span>{countLabel(activeProjectOrders.filter((order) => order.class?.school_id === schoolId).length, "заявка", "заявки", "заявок")}</span><span>{countLabel(orderedServiceCount(activeProjectOrders.filter((order) => order.class?.school_id === schoolId)), "заказ", "заказа", "заказов")}</span></strong>
      </div>
      {!schoolClasses.length ? <EmptyState icon={<GraduationCap/>} title="Классов пока нет" text="В выбранном проекте ещё нет классов."/> : <div className="order-class-grid">
        {schoolClasses.map((schoolClass) => {
          const orders = activeProjectOrders.filter((order) => order.class_id === schoolClass.id);
          return <button type="button" className="order-class-card" key={schoolClass.id} onClick={() => setClassId(schoolClass.id)}>
            <span className="order-class-badge">{schoolClass.name}</span>
            <span className="order-class-copy"><strong>{schoolClass.photo_session_name || `Класс ${schoolClass.name}`}</strong><small>{schoolClass.academic_year}</small></span>
            <span className="order-class-count"><b>{orders.length}</b><small>{countLabel(orders.length, "заявка", "заявки", "заявок").replace(/^\d+ /, "")}</small></span>
            <span className="order-class-count order-class-orders"><b>{orderedServiceCount(orders)}</b><small>{countLabel(orderedServiceCount(orders), "заказ", "заказа", "заказов").replace(/^\d+ /, "")}</small></span>
            <ChevronRight aria-hidden="true"/>
          </button>;
        })}
      </div>}
    </section> : <section aria-labelledby="orders-children-title">
      <div className="orders-section-heading">
        <div><span>Шаг 3</span><h2 id="orders-children-title">Карточки детей</h2></div>
        <strong className="orders-total"><span>{countLabel(visibleOrders.length, "заявка", "заявки", "заявок")}</span><span>{countLabel(orderedServiceCount(visibleOrders), "заказ", "заказа", "заказов")}</span></strong>
      </div>
      {!visibleOrders.length ? <EmptyState icon={<ClipboardList/>} title="Заявок в классе пока нет" text="После выбора услуг родителем карточка появится здесь."/> : <div className="order-child-grid">
        {visibleOrders.map((order) => {
          const preview = order.selected_items.find((item) => item.preview_url)?.preview_url;
          return <article className="order-child-card" key={order.id}>
            <div className="order-child-preview">{preview ? <img src={preview} alt="" loading="lazy" decoding="async"/> : <ImageIcon aria-hidden="true"/>}</div>
            <div className="order-child-main">
              <div className="order-child-title"><span className="order-child-avatar"><UserRound/></span><div><strong>{fullChildName(order.child) || "Ребёнок"}</strong><small>{order.order_number} · {formatDateTime(order.created_at)}</small></div></div>
              <div className="order-service-list">{order.selected_items.map((item, index) => <div key={`${item.id}-${index}`}><span>{item.name}{(item.quantity || 1) > 1 ? ` × ${item.quantity}` : ""}</span><strong>{money(item.price * (item.quantity || 1))}</strong>{item.comment && <small>{item.comment}</small>}{item.reference_service_name && <small>Услуга-референс: {item.reference_service_name}</small>}{item.reference_path && referenceUrls[item.reference_path] && <a className="order-reference-preview" href={referenceUrls[item.reference_path]} target="_blank" rel="noreferrer"><img src={referenceUrls[item.reference_path]} alt="Скрин-референс" loading="lazy"/>Открыть скрин</a>}</div>)}</div>
            </div>
            <footer><strong>{money(order.total_amount)}</strong><select aria-label={`Статус заявки ${fullChildName(order.child)}`} className={`status-select status-${order.status}`} value={order.status} onChange={(event) => void changeStatus(order, event.target.value as OrderStatus)}>{Object.entries(orderStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></footer>
          </article>;
        })}
      </div>}
    </section>}
  </div>;
}
