import { ArrowLeft, ChevronRight, CirclePlus, GraduationCap, UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EmptyState, FormActions, Loader, Modal, Notice } from "../components/ui";
import { createClass, loadSchool } from "../lib/repository";
import { humanError } from "../lib/helpers";
import type { ClassWithStats, School } from "../lib/types";

export function SchoolPage() {
  const { schoolId = "" } = useParams(); const navigate = useNavigate();
  const [school, setSchool] = useState<School | null>(null); const [classes, setClasses] = useState<ClassWithStats[]>([]);
  const [loading, setLoading] = useState(true); const [modal, setModal] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState("");
  async function refresh() { setLoading(true); try { const data = await loadSchool(schoolId); setSchool(data.school); setClasses(data.classes); } catch (reason) { setError(humanError(reason)); } finally { setLoading(false); } }
  useEffect(() => { void refresh(); }, [schoolId]);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setPending(true); setError(""); const form = new FormData(event.currentTarget); try { const item = await createClass({ school_id: schoolId, name: String(form.get("name") || "").trim(), academic_year: String(form.get("academic_year") || "").trim(), teacher_name: String(form.get("teacher_name") || "").trim(), photo_session_name: String(form.get("photo_session_name") || "").trim() || `Фотосессия ${String(form.get("name") || "").trim()}` }); setModal(false); navigate(`/admin/classes/${item.id}`); } catch (reason) { setError(humanError(reason)); } finally { setPending(false); } }
  if (loading) return <div className="page"><Loader label="Загружаем школу…"/></div>;
  if (!school) return <div className="page"><Notice kind="error">Школа не найдена</Notice></div>;
  return <div className="page"><Link className="back-link" to="/admin/schools"><ArrowLeft size={17}/>Все школы</Link>
    <header className="page-header"><div><span className="eyebrow">{school.city}</span><h1>{school.name}</h1><p>{school.address || "Адрес не указан"}{school.contact_name ? ` · ${school.contact_name}` : ""}</p></div><button className="button button-primary" onClick={() => setModal(true)}><CirclePlus size={19}/>Добавить класс</button></header>
    {error && <Notice kind="error">{error}</Notice>}
    <section className="section-card"><div className="section-title"><div><h2>Классы</h2><p>Дети, заявки и ссылка для каждого класса</p></div></div>
      {classes.length === 0 ? <EmptyState icon={<GraduationCap/>} title="Классов пока нет" text="Добавьте первый класс и список детей." action={<button className="button button-primary" onClick={() => setModal(true)}>Добавить класс</button>}/> : <div className="class-list">{classes.map((item) => <Link to={`/admin/classes/${item.id}`} className="class-row" key={item.id}><div className="class-badge">{item.name}</div><div className="class-info"><strong>{item.photo_session_name}</strong><span><UserRound size={14}/>{item.teacher_name || "Учитель не указан"} · {item.academic_year}</span></div><div className="class-stats"><span><strong>{item.children_count}</strong> детей</span><span><strong>{item.orders_count}</strong> заявок</span><span className={item.missing_orders_count ? "warning-text" : "success-text"}><strong>{item.missing_orders_count}</strong> без заявки</span></div><ChevronRight/></Link>)}</div>}
    </section>
    {modal && <Modal title="Добавить класс" onClose={() => setModal(false)}><form className="form-stack" onSubmit={submit}><div className="form-grid"><label>Название класса *<input name="name" required placeholder="3А"/></label><label>Учебный год *<input name="academic_year" required defaultValue="2026/2027" placeholder="2026/2027"/></label></div><label>Название фотосессии<input name="photo_session_name" placeholder="Фотосессия 3А"/></label><label>Классный руководитель<input name="teacher_name" placeholder="Необязательно"/></label><FormActions pending={pending} submitLabel="Создать класс" onCancel={() => setModal(false)}/></form></Modal>}
  </div>;
}
