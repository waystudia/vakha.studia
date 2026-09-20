import { Building2, ChevronRight, CirclePlus, MapPin, Pencil, Users } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState, FormActions, Loader, Modal, Notice } from "../components/ui";
import { formatDate, humanError } from "../lib/helpers";
import { createSchool, loadSchools, updateSchool } from "../lib/repository";
import type { SchoolWithStats } from "../lib/types";

export function SchoolsPage() {
  const [schools, setSchools] = useState<SchoolWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<SchoolWithStats | null | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const navigate = useNavigate();

  async function refresh() {
    setLoading(true); setError("");
    try { setSchools(await loadSchools()); } catch (reason) { setError(humanError(reason)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const input = { name: String(form.get("name") || "").trim(), city: String(form.get("city") || "").trim(), address: String(form.get("address") || "").trim(), contact_name: String(form.get("contact_name") || "").trim() };
      const school = editing ? await updateSchool(editing.id, input) : await createSchool(input);
      setEditing(undefined); await refresh();
      if (!editing) navigate(`/admin/schools/${school.id}`);
    } catch (reason) { setError(humanError(reason)); } finally { setPending(false); }
  }

  async function archive(school: SchoolWithStats) {
    if (!window.confirm(`Архивировать школу «${school.name}»? Данные сохранятся.`)) return;
    try { await updateSchool(school.id, { status: "archived" }); await refresh(); } catch (reason) { setError(humanError(reason)); }
  }

  return <div className="page">
    <header className="page-header"><div><span className="eyebrow">АДМИНИСТРИРОВАНИЕ</span><h1>Школы</h1><p>Создавайте школы, классы и ссылки для родителей.</p></div><button className="button button-primary" onClick={() => setEditing(null)}><CirclePlus size={19}/>Создать школу</button></header>
    {error && <Notice kind="error">{error}</Notice>}
    {loading ? <Loader label="Загружаем школы…"/> : schools.length === 0 ? <EmptyState icon={<Building2/>} title="Школ пока нет" text="Создайте первую школу, затем добавьте класс и список детей." action={<button className="button button-primary" onClick={() => setEditing(null)}>Создать школу</button>}/> :
      <div className="school-grid">{schools.map((school) => <article className="school-card" key={school.id}>
        <div className="card-heading"><div className="school-icon"><Building2/></div><div><h2>{school.name}</h2><p><MapPin size={14}/>{school.city}</p></div></div>
        <div className="stats-row"><span><strong>{school.classes_count}</strong>классов</span><span><strong>{school.children_count}</strong>детей</span><span><strong>{school.orders_count}</strong>заявок</span></div>
        <div className="card-meta">Создана {formatDate(school.created_at)}</div>
        <div className="card-actions"><Link className="button button-primary" to={`/admin/schools/${school.id}`}>Открыть<ChevronRight size={17}/></Link><button className="icon-button" onClick={() => setEditing(school)} title="Изменить"><Pencil size={18}/></button><button className="text-danger" onClick={() => void archive(school)}>Архивировать</button></div>
      </article>)}</div>}
    {editing !== undefined && <Modal title={editing ? "Изменить школу" : "Создать школу"} onClose={() => setEditing(undefined)}><form className="form-stack" onSubmit={submit}>
      <label>Название школы *<input name="name" required minLength={2} defaultValue={editing?.name || ""} placeholder="Например, Лицей №12"/></label>
      <label>Город *<input name="city" required minLength={2} defaultValue={editing?.city || ""} placeholder="Москва"/></label>
      <label>Адрес<input name="address" defaultValue={editing?.address || ""} placeholder="Улица, дом — необязательно"/></label>
      <label>Контактное лицо<input name="contact_name" defaultValue={editing?.contact_name || ""} placeholder="Имя — необязательно"/></label>
      <FormActions pending={pending} submitLabel={editing ? "Сохранить" : "Создать школу"} onCancel={() => setEditing(undefined)}/>
    </form></Modal>}
  </div>;
}
