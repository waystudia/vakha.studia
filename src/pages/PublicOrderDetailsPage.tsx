import { ArrowLeft, CheckCircle2, Image as ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader } from "../components/ui";
import { humanError, money } from "../lib/helpers";
import { getPublicOrder } from "../lib/repository";
import type { PublicOrderPayload } from "../lib/types";

export function PublicOrderDetailsPage() {
  const { token = "" } = useParams(); const [data, setData] = useState<PublicOrderPayload | null>(null); const [error, setError] = useState("");
  useEffect(() => { void (async () => { try { const payload = await getPublicOrder(token); if (!payload) throw new Error("Ссылка на заявку недействительна"); setData(payload); } catch (reason) { setError(humanError(reason)); } })(); }, [token]);
  if (!data && !error) return <main className="public-page"><Loader label="Открываем заявку…"/></main>;
  if (error || !data) return <main className="public-page"><section className="public-error"><h1>Заявка недоступна</h1><p>{error}</p></section></main>;
  return <main className="public-page"><div className="public-shell"><header className="public-header"><div className="public-logo"><span className="brand-mark">VS</span><div><strong>Vakha Studio</strong><small>Заявка родителя</small></div></div></header><section className="success-screen"><div className="success-mark"><CheckCircle2/></div><h1>Заявка {data.order_number}</h1><span className="success-pill">{data.status === "new" ? "Принята" : data.status}</span><div className="confirmation-card"><div><span>Школа</span><strong>{data.school_name}</strong></div><div><span>Класс</span><strong>{data.class_name}</strong></div><div><span>Ребёнок</span><strong>{data.child_name}</strong></div><div><span>Услуги</span><strong>{data.selected_items.map((item) => item.name).join(", ")}</strong></div><div><span>Итого</span><strong>{money(data.total_amount)}</strong></div></div><div className="success-items">{data.selected_items.map((item) => <div className="success-item" key={item.id}>{item.preview_url ? <img src={item.preview_url} alt=""/> : <ImageIcon/>}<span>{item.name}</span><strong>{money(item.price)}</strong></div>)}</div><Link className="button button-primary button-wide" to="/">Готово</Link><div><ArrowLeft size={16}/> Ссылка только для просмотра</div></section></div></main>;
}
