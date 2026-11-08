import { Building2, ExternalLink, UserRound, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader, Notice } from "../components/ui";
import { humanError } from "../lib/helpers";
import { supabase } from "../lib/supabase";

type Inquiry = {
  id: string;
  institution: string;
  city: string;
  group_name: string;
  contact_name: string;
  phone: string;
  note: string;
  status: string;
  created_at: string;
  services: { name: string }[];
  school_id: string | null;
  class_id: string | null;
  child_id: string | null;
  order_id: string | null;
};

export function InquiriesPage() {
  const [rows, setRows] = useState<Inquiry[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState("");

  useEffect(() => {
    void supabase.from("catalog_inquiries").select("*").order("created_at", { ascending: false }).then(({ data, error: loadError }) => {
      if (loadError) setError(humanError(loadError));
      else setRows((data || []) as Inquiry[]);
      setLoading(false);
    });
  }, []);

  return <div className="inquiries-page">
    <h1>Новые школы и садики</h1>
    <p>Заявки из общего каталога. Проект, класс или группа и ребёнок создаются автоматически.</p>
    {error && <Notice kind="error">{error}</Notice>}
    {loading ? <Loader label="Загружаем заявки…"/> : rows.length === 0 ? <p>Заявок пока нет. Отправьте учреждениям публичную ссылку из профиля.</p> : <div className="inquiry-grid">
      {rows.map(row => <article className="form-card inquiry-card" key={row.id}>
        <header><div><h2>{row.institution}</h2><p>{[row.city, row.group_name].filter(Boolean).join(" · ")}</p></div><small>{new Date(row.created_at).toLocaleString("ru-RU")}</small></header>
        <div className="inquiry-entity-row">
          {row.school_id && <Link to={`/admin/schools/${row.school_id}`}><Building2 aria-hidden="true"/><span><small>Проект</small><strong>{row.institution}</strong></span><ExternalLink aria-hidden="true"/></Link>}
          {row.class_id && <Link to={`/admin/classes/${row.class_id}`}><Users aria-hidden="true"/><span><small>Класс / группа</small><strong>{row.group_name}</strong></span><ExternalLink aria-hidden="true"/></Link>}
          <div><UserRound aria-hidden="true"/><span><small>Ребёнок</small><strong>{row.contact_name}</strong></span></div>
        </div>
        <p><a href={`tel:+${row.phone}`}>+{row.phone}</a></p>
        <p className="inquiry-services">{row.services.map(item => item.name).join(", ")}</p>
        {row.note && <p className="inquiry-note">{row.note}</p>}
        <label>Статус<select value={row.status} disabled={pending === row.id} onChange={async event => {
          const status = event.target.value;
          setPending(row.id);
          setError("");
          const { error: updateError } = await supabase.from("catalog_inquiries").update({ status }).eq("id", row.id).select("id").single();
          if (updateError) setError(humanError(updateError));
          else setRows(old => old.map(item => item.id === row.id ? { ...item, status } : item));
          setPending("");
        }}><option value="new">Новая</option><option value="contacted">Связались</option><option value="closed">Закрыта</option></select></label>
      </article>)}
    </div>}
  </div>;
}
