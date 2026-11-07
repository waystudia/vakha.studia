import { BarChart3, Building2, Eye, MapPin, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Loader, Notice } from "../components/ui";
import { formatDateTime, humanError } from "../lib/helpers";
import { loadVisitAnalytics } from "../lib/repository";
import type { PublicPageVisit } from "../lib/types";

function sourceName(row: PublicPageVisit) {
  if (row.page_kind === "catalog") return "Общий каталог";
  return [row.school?.name, row.class?.name].filter(Boolean).join(" · ") || "Ссылка класса";
}

export function AnalyticsPage() {
  const [rows, setRows] = useState<PublicPageVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadVisitAnalytics().then(setRows).catch((reason) => setError(humanError(reason))).finally(() => setLoading(false));
  }, []);

  const totalOpens = rows.reduce((sum, row) => sum + row.open_count, 0);
  const uniqueNetworks = new Set(rows.map((row) => row.visitor_hash)).size;
  const locations = useMemo(() => {
    const groups = new Map<string, { name: string; opens: number; visitors: Set<string> }>();
    rows.forEach((row) => {
      const name = row.school?.city || "Не указано";
      const current = groups.get(name) || { name, opens: 0, visitors: new Set<string>() };
      current.opens += row.open_count;
      current.visitors.add(row.visitor_hash);
      groups.set(name, current);
    });
    return [...groups.values()].sort((left, right) => right.opens - left.opens);
  }, [rows]);
  const sources = useMemo(() => {
    const groups = new Map<string, { name: string; opens: number; visitors: Set<string>; lastSeen: string }>();
    rows.forEach((row) => {
      const current = groups.get(row.source_key) || { name: sourceName(row), opens: 0, visitors: new Set<string>(), lastSeen: row.last_seen_at };
      current.opens += row.open_count;
      current.visitors.add(row.visitor_hash);
      if (row.last_seen_at > current.lastSeen) current.lastSeen = row.last_seen_at;
      groups.set(row.source_key, current);
    });
    return [...groups.values()].sort((left, right) => right.opens - left.opens);
  }, [rows]);

  if (loading) return <div className="page"><Loader label="Загружаем статистику…" /></div>;
  return <div className="page analytics-page">
    <header className="page-header"><div><span className="eyebrow">ПОСЕЩЕНИЯ ССЫЛОК</span><h1>Аналитика</h1><p>Открытия публичного каталога и ссылок классов.</p></div></header>
    {error && <Notice kind="error">{error}</Notice>}
    <section className="analytics-summary" aria-label="Общая статистика">
      <article><Eye/><span>Всего открытий</span><strong>{totalOpens}</strong></article>
      <article><UsersRound/><span>Примерно посетителей</span><strong>{uniqueNetworks}</strong></article>
      <article><MapPin/><span>Сёл в ссылках</span><strong>{locations.filter((item) => item.name !== "Не указано").length}</strong></article>
    </section>
    <Notice kind="info">VPN-страны и города не записываются. Село определяется по школе и классу, чью ссылку открыли. IP хранится только как необратимый хеш: несколько людей на одном Wi‑Fi могут считаться одним посетителем.</Notice>
    <div className="analytics-columns">
      <section className="analytics-panel"><div className="analytics-title"><MapPin/><div><h2>По сёлам</h2><p>По проекту школы, а не по VPN</p></div></div>
        {locations.length ? <div className="analytics-list">{locations.map((item) => <article key={item.name}><div><strong>{item.name}</strong><span>{item.visitors.size} посетителей</span></div><b>{item.opens} открытий</b></article>)}</div> : <p className="analytics-empty">Открытий пока нет.</p>}
      </section>
      <section className="analytics-panel"><div className="analytics-title"><Building2/><div><h2>По ссылкам</h2><p>Школы, классы и общий каталог</p></div></div>
        {sources.length ? <div className="analytics-list">{sources.map((item) => <article key={item.name}><div><strong>{item.name}</strong><span>{item.visitors.size} посетителей · последнее {formatDateTime(item.lastSeen)}</span></div><b>{item.opens} открытий</b></article>)}</div> : <p className="analytics-empty">После первого открытия здесь появится статистика.</p>}
      </section>
    </div>
    <p className="analytics-footnote"><BarChart3 size={16}/> Статистика собирается с момента публикации этого обновления. Прошлые открытия восстановить нельзя.</p>
  </div>;
}
