import { ClipboardList, Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EmptyState, Loader, Notice } from "../components/ui";
import { downloadCsv, formatDateTime, humanError, money, orderStatusLabels } from "../lib/helpers";
import { loadOrders, updateOrderStatus } from "../lib/repository";
import type { OrderStatus, ParentOrder } from "../lib/types";

export function OrdersPage() {
  const [orders, setOrders] = useState<ParentOrder[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [status, setStatus] = useState<"all" | OrderStatus>("all"); const [search, setSearch] = useState("");
  async function refresh() { setLoading(true); try { setOrders(await loadOrders()); } catch (reason) { setError(humanError(reason)); } finally { setLoading(false); } }
  useEffect(() => { void refresh(); }, []);
  const filtered = useMemo(() => orders.filter((order) => (status === "all" || order.status === status) && `${order.order_number} ${order.child?.public_name || ""} ${order.class?.school?.name || ""}`.toLowerCase().includes(search.toLowerCase())), [orders, status, search]);
  async function changeStatus(order: ParentOrder, next: OrderStatus) { try { await updateOrderStatus(order.id, next); setOrders((items) => items.map((item) => item.id === order.id ? { ...item, status: next } : item)); } catch (reason) { setError(humanError(reason)); } }
  function exportAll() { const rows: unknown[][] = [["Школа", "Класс", "Ребёнок", "Номер заявки", "Выбранные услуги", "Сумма", "Статус", "Дата заявки", "Комментарий"]]; filtered.forEach((order) => rows.push([order.class?.school?.name, order.class?.name, order.child?.public_name, order.order_number, order.selected_items.map((item) => item.name).join(", "), order.total_amount, orderStatusLabels[order.status], formatDateTime(order.created_at), order.parent_note])); downloadCsv("vakha_studio_заявки.csv", rows); }
  return <div className="page"><header className="page-header"><div><span className="eyebrow">ЗАЯВКИ РОДИТЕЛЕЙ</span><h1>Заявки</h1><p>Проверяйте состав заказа и меняйте статус работы.</p></div><button className="button button-secondary" disabled={!filtered.length} onClick={exportAll}><Download size={18}/>Экспорт CSV</button></header>
    {error && <Notice kind="error">{error}</Notice>}
    <div className="filters"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Номер, ребёнок или школа"/><select value={status} onChange={(e) => setStatus(e.target.value as "all" | OrderStatus)}><option value="all">Все статусы</option>{Object.entries(orderStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>
    {loading ? <Loader label="Загружаем заявки…"/> : !filtered.length ? <EmptyState icon={<ClipboardList/>} title="Заявок пока нет" text="После отправки родителем заявка появится здесь."/> : <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Заявка</th><th>Школа и класс</th><th>Ребёнок</th><th>Услуги</th><th>Сумма</th><th>Дата</th><th>Статус</th></tr></thead><tbody>{filtered.map((order) => <tr key={order.id}><td><strong>{order.order_number}</strong></td><td>{order.class?.school?.name}<small>{order.class?.name}</small></td><td>{order.child?.public_name}</td><td>{order.selected_items.map((item) => item.name).join(", ")}</td><td><strong>{money(order.total_amount)}</strong></td><td>{formatDateTime(order.created_at)}</td><td><select className={`status-select status-${order.status}`} value={order.status} onChange={(e) => void changeStatus(order, e.target.value as OrderStatus)}>{Object.entries(orderStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td></tr>)}</tbody></table></div>}
  </div>;
}
