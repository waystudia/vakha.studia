import { Building2, Check, LoaderCircle, MapPin, MessageCircle, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  searchCatalogInstitutions,
  submitCatalogIntake,
  type CatalogInstitutionMatch,
  type CatalogIntakeResult,
} from "../lib/repository";
import { humanError, money } from "../lib/helpers";
import { Notice } from "./ui";

type InquiryItem = { id: string; name: string; price: number };
type WhatsAppConfig = { phone?: string; company?: string; manager?: string };

export function catalogWhatsAppUrl(config: WhatsAppConfig | undefined, input: {
  institution: string;
  city: string;
  groupName: string;
  childName: string;
  phone: string;
  note: string;
  items: InquiryItem[];
  orderNumber?: string;
}) {
  const destination = (config?.phone || "").replace(/\D/g, "");
  if (!destination) return "";
  const services = input.items.map(item => `• ${item.name} — ${money(item.price)}`).join("\n");
  const total = input.items.reduce((sum, item) => sum + Number(item.price), 0);
  const greeting = config?.manager ? `Здравствуйте, ${config.manager}!` : "Здравствуйте!";
  const message = [
    greeting,
    `Хочу заказать услуги ${config?.company || "Khan Zama"}.`,
    input.orderNumber ? `Заявка: ${input.orderNumber}` : "",
    "",
    `Школа или детский сад: ${input.institution}`,
    input.city ? `Населённый пункт: ${input.city}` : "",
    `Класс или группа: ${input.groupName}`,
    `Ребёнок: ${input.childName}`,
    `Телефон: ${input.phone}`,
    "",
    "Выбранные услуги:",
    services,
    `Итого: ${money(total)}`,
    input.note ? `Комментарий: ${input.note}` : "",
  ].filter(Boolean).join("\n");
  return `https://wa.me/${destination}?text=${encodeURIComponent(message)}`;
}

export function CatalogInquiry({ token, items, whatsapp, open, onClose }: {
  token: string;
  items: InquiryItem[];
  whatsapp?: WhatsAppConfig;
  open: boolean;
  onClose: () => void;
}) {
  const key = useRef(crypto.randomUUID());
  const firstField = useRef<HTMLInputElement>(null);
  const lookupSequence = useRef(0);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<CatalogIntakeResult | null>(null);
  const [doneUrl, setDoneUrl] = useState("");
  const [error, setError] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [institutionQuery, setInstitutionQuery] = useState("");
  const [matches, setMatches] = useState<CatalogInstitutionMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [institutionMode, setInstitutionMode] = useState<"search" | "existing" | "new">("search");
  const [selectedInstitution, setSelectedInstitution] = useState<CatalogInstitutionMatch | null>(null);
  const [city, setCity] = useState("");
  const [groupMode, setGroupMode] = useState<"" | "existing" | "new">("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [groupName, setGroupName] = useState("");

  const institutionReady = institutionMode === "existing" || institutionMode === "new";
  const groupReady = groupMode === "existing" || (groupMode === "new" && groupName.trim().length > 0);
  const step = institutionReady ? (groupReady ? 3 : 2) : 1;
  const institutionLabel = selectedInstitution?.name || institutionQuery.trim();
  const selectedClass = useMemo(
    () => selectedInstitution?.classes.find(item => item.id === selectedClassId),
    [selectedClassId, selectedInstitution],
  );

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    document.body.classList.add("catalog-sheet-open");
    const timer = window.setTimeout(() => firstField.current?.focus(), 280);
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", close);
    return () => {
      window.clearTimeout(timer);
      document.body.classList.remove("catalog-sheet-open");
      document.removeEventListener("keydown", close);
      previous?.focus();
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || institutionMode !== "search" || institutionQuery.trim().length < 2) {
      setMatches([]);
      setSearching(false);
      return;
    }
    const sequence = ++lookupSequence.current;
    setSearching(true);
    setLookupError("");
    const timer = window.setTimeout(() => {
      void searchCatalogInstitutions(token, institutionQuery.trim())
        .then(result => { if (sequence === lookupSequence.current) setMatches(result); })
        .catch(reason => { if (sequence === lookupSequence.current) setLookupError(humanError(reason)); })
        .finally(() => { if (sequence === lookupSequence.current) setSearching(false); });
    }, 260);
    return () => window.clearTimeout(timer);
  }, [institutionMode, institutionQuery, open, token]);

  function resetInstitution(value: string) {
    setInstitutionQuery(value);
    setInstitutionMode("search");
    setSelectedInstitution(null);
    setCity("");
    setGroupMode("");
    setSelectedClassId("");
    setGroupName("");
    setError("");
  }

  function chooseInstitution(match: CatalogInstitutionMatch) {
    setInstitutionQuery(match.name);
    setSelectedInstitution(match);
    setCity(match.city);
    setInstitutionMode("existing");
    setGroupMode("");
    setSelectedClassId("");
    setGroupName("");
  }

  function chooseClass(classId: string, name: string) {
    setSelectedClassId(classId);
    setGroupName(name);
    setGroupMode("existing");
  }

  return <div className="catalog-inquiry-layer" data-open={open} aria-hidden={!open} inert={!open}>
    <button className="catalog-inquiry-backdrop" type="button" aria-label="Закрыть оформление заявки" tabIndex={open ? 0 : -1} onClick={onClose}/>
    <section className="catalog-inquiry-sheet" role="dialog" aria-modal="true" aria-labelledby="catalog-inquiry-title">
      <div className="catalog-inquiry-handle" aria-hidden="true"/>
      <header>
        <div><h2 id="catalog-inquiry-title">Оформить заявку</h2><p>Школа или садик · выбрано услуг: {items.length}</p></div>
        <button className="icon-button" type="button" aria-label="Закрыть" onClick={onClose}><X size={20}/></button>
      </header>
      {done ? <div className="catalog-inquiry-done">
        <div className="catalog-inquiry-success-mark" aria-hidden="true"><Check/></div>
        <div><h3>Готово — ребёнок добавлен</h3><p>{done.institution} · {done.group_name}<br/>Заявка {done.order_number} уже появилась в CRM.</p></div>
        {doneUrl ? <a className="button button-primary button-wide" href={doneUrl} target="_blank" rel="noreferrer"><MessageCircle size={18}/>Открыть WhatsApp</a> : <Notice kind="success">Менеджер уже видит заявку в CRM.</Notice>}
      </div> : <form onSubmit={async event => {
        event.preventDefault();
        if (pending || !institutionReady || !groupReady) return;
        const form = new FormData(event.currentTarget);
        const childFirstName = String(form.get("first") || "").trim();
        const childLastName = String(form.get("last") || "").trim();
        const phone = String(form.get("phone") || "").trim();
        const note = String(form.get("note") || "").trim();
        setPending(true);
        setError("");
        try {
          const result = await submitCatalogIntake({
            token,
            requestKey: key.current,
            schoolId: selectedInstitution?.id,
            institutionName: institutionLabel,
            city: selectedInstitution?.city || city.trim(),
            classId: groupMode === "existing" ? selectedClassId : undefined,
            groupName: selectedClass?.name || groupName.trim(),
            childFirstName,
            childLastName,
            phone,
            itemIds: items.map(item => item.id),
            note,
          });
          const url = catalogWhatsAppUrl(whatsapp, {
            institution: result.institution,
            city: result.city,
            groupName: result.group_name,
            childName: `${childLastName} ${childFirstName}`,
            phone,
            note,
            items,
            orderNumber: result.order_number,
          });
          setDone(result);
          setDoneUrl(url);
          if (url) window.open(url, "_blank", "noopener,noreferrer");
        } catch (reason) {
          setError(humanError(reason));
        } finally {
          setPending(false);
        }
      }}>
        <div className="catalog-inquiry-progress" aria-label={`Шаг ${step} из 3`}>
          <span>Шаг {step} из 3</span><div aria-hidden="true"><i data-active={step >= 1}/><i data-active={step >= 2}/><i data-active={step >= 3}/></div>
        </div>
        <fieldset disabled={pending}>
          <section className="catalog-inquiry-section" aria-labelledby="institution-heading">
            <div className="catalog-inquiry-section-title"><span>1</span><div><h3 id="institution-heading">Школа или детский сад</h3><p>Начните вводить название — покажем похожие.</p></div></div>
            {institutionMode === "search" ? <>
              <label>Название учреждения
                <span className="catalog-inquiry-input-wrap"><Building2 size={18} aria-hidden="true"/><input ref={firstField} value={institutionQuery} onChange={event => resetInstitution(event.target.value)} required minLength={2} maxLength={160} autoComplete="organization" placeholder="Например, Детский сад №24"/></span>
              </label>
              <div className="catalog-inquiry-lookup" aria-live="polite">
                {searching && <p className="catalog-inquiry-searching"><LoaderCircle className="spin"/>Ищем похожие…</p>}
                {!searching && matches.map(match => <button key={match.id} type="button" className="catalog-inquiry-choice" onClick={() => chooseInstitution(match)}>
                  <span className="catalog-inquiry-choice-icon"><Building2 aria-hidden="true"/></span>
                  <span><strong>{match.name}</strong><small><MapPin aria-hidden="true"/>{match.city} · {match.classes.length ? `${match.classes.length} кл./гр.` : "без групп"}</small></span>
                  <span className="catalog-inquiry-choice-action">Это моё</span>
                </button>)}
                {lookupError && <Notice kind="error">Не удалось проверить совпадения. Можно создать новое учреждение.</Notice>}
                {institutionQuery.trim().length >= 2 && !searching && <button className="catalog-inquiry-create" type="button" onClick={() => { setInstitutionMode("new"); setSelectedInstitution(null); setGroupMode("new"); }}>
                  <span>+</span><span><strong>Создать новое учреждение</strong><small>Если нужного варианта нет выше</small></span>
                </button>}
              </div>
            </> : <div className="catalog-inquiry-selected">
              <span className="catalog-inquiry-choice-icon"><Check aria-hidden="true"/></span><span><strong>{institutionLabel}</strong><small>{selectedInstitution?.city || "Новое учреждение"}</small></span>
              <button type="button" onClick={() => resetInstitution(institutionLabel)}>Изменить</button>
            </div>}
            {institutionMode === "new" && <label>Населённый пункт<input value={city} onChange={event => setCity(event.target.value)} required minLength={2} maxLength={120} autoComplete="address-level2" placeholder="Город или село"/></label>}
          </section>

          {institutionReady && <section className="catalog-inquiry-section" aria-labelledby="group-heading">
            <div className="catalog-inquiry-section-title"><span>2</span><div><h3 id="group-heading">Класс или группа</h3><p>Выберите существующую или добавьте свою.</p></div></div>
            {selectedInstitution && groupMode !== "new" && <div className="catalog-inquiry-class-grid">
              {selectedInstitution.classes.map(item => <button key={item.id} type="button" className="catalog-inquiry-class" data-selected={selectedClassId === item.id} onClick={() => chooseClass(item.id, item.name)}>
                <Users aria-hidden="true"/><span><strong>{item.name}</strong><small>{item.academic_year}</small></span>{selectedClassId === item.id && <Check aria-hidden="true"/>}
              </button>)}
            </div>}
            {groupMode !== "new" && <button className="catalog-inquiry-create" type="button" onClick={() => { setGroupMode("new"); setSelectedClassId(""); setGroupName(""); }}>
              <span>+</span><span><strong>{selectedInstitution?.classes.length ? "Другая группа или класс" : "Добавить группу или класс"}</strong><small>Создадим её автоматически</small></span>
            </button>}
            {groupMode === "new" && <label>Название класса или группы<input value={groupName} onChange={event => setGroupName(event.target.value)} required minLength={1} maxLength={60} placeholder="Например, 3А или Младшая группа"/></label>}
          </section>}

          {institutionReady && groupReady && <section className="catalog-inquiry-section" aria-labelledby="child-heading">
            <div className="catalog-inquiry-section-title"><span>3</span><div><h3 id="child-heading">Данные ребёнка</h3><p>Ребёнок сразу появится в выбранной группе.</p></div></div>
            <div className="catalog-inquiry-name"><label>Фамилия<input name="last" autoComplete="family-name" required maxLength={100}/></label><label>Имя<input name="first" autoComplete="given-name" required maxLength={100}/></label></div>
            <label>Телефон родителя<input name="phone" type="tel" inputMode="tel" autoComplete="tel" required pattern="[+0-9 ()\-]{10,25}" placeholder="+7 900 000-00-00"/></label>
            <label>Комментарий <span className="catalog-inquiry-optional">необязательно</span><textarea name="note" rows={3} maxLength={1000} placeholder="Пожелания к заказу"/></label>
            <label className="catalog-inquiry-consent"><input type="checkbox" required/> Разрешаю связаться со мной по поводу этой заявки</label>
          </section>}
          {error && <Notice kind="error">{error}</Notice>}
          {institutionReady && groupReady && <button className="button button-primary button-wide" disabled={!items.length || pending}>{pending ? "Создаём проект и заявку…" : "Отправить заявку"}</button>}
        </fieldset>
      </form>}
    </section>
  </div>;
}
