import { MessageCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { submitCatalogInquiry } from "../lib/repository";
import { humanError, money } from "../lib/helpers";
import { Notice } from "./ui";

type InquiryItem = { id: string; name: string; price: number };
type WhatsAppConfig = { phone?: string; company?: string; manager?: string };

export function catalogWhatsAppUrl(config: WhatsAppConfig | undefined, input: { institution: string; contactName: string; phone: string; note: string; items: InquiryItem[] }) {
  const destination = (config?.phone || "").replace(/\D/g, "");
  if (!destination) return "";
  const services = input.items.map(item => `• ${item.name} — ${money(item.price)}`).join("\n");
  const total = input.items.reduce((sum, item) => sum + Number(item.price), 0);
  const greeting = config?.manager ? `Здравствуйте, ${config.manager}!` : "Здравствуйте!";
  const message = [greeting, `Хочу заказать услуги ${config?.company || "Khan Zama"}.`, "", `Школа или детский сад: ${input.institution}`, `Контакт: ${input.contactName}`, `Телефон: ${input.phone}`, "", "Выбранные услуги:", services, `Итого: ${money(total)}`, input.note ? `Комментарий: ${input.note}` : ""].filter(Boolean).join("\n");
  return `https://wa.me/${destination}?text=${encodeURIComponent(message)}`;
}

export function CatalogInquiry({ token, items, whatsapp, open, onClose }: { token: string; items: InquiryItem[]; whatsapp?: WhatsAppConfig; open: boolean; onClose: () => void }) {
  const key = useRef(crypto.randomUUID());
  const firstField = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [doneUrl, setDoneUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    document.body.classList.add("catalog-sheet-open");
    const timer = window.setTimeout(() => firstField.current?.focus(), 280);
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", close);
    return () => { window.clearTimeout(timer); document.body.classList.remove("catalog-sheet-open"); document.removeEventListener("keydown", close); previous?.focus(); };
  }, [open, onClose]);
  return <div className="catalog-inquiry-layer" data-open={open} aria-hidden={!open} inert={!open}><button className="catalog-inquiry-backdrop" type="button" aria-label="Закрыть оформление заявки" tabIndex={open ? 0 : -1} onClick={onClose}/><section className="catalog-inquiry-sheet" role="dialog" aria-modal="true" aria-labelledby="catalog-inquiry-title"><div className="catalog-inquiry-handle" aria-hidden="true"/><header><div><h2 id="catalog-inquiry-title">Оформить заявку</h2><p>Школа или детский сад · выбрано услуг: {items.length}</p></div><button className="icon-button" type="button" aria-label="Закрыть" onClick={onClose}><X size={20}/></button></header>{done ? <div className="catalog-inquiry-done"><Notice kind="success">Заявка сохранена.</Notice>{doneUrl ? <><p>Отправьте её менеджеру в WhatsApp.</p><a className="button button-primary button-wide" href={doneUrl} target="_blank" rel="noreferrer"><MessageCircle size={18}/>Открыть WhatsApp</a></> : <Notice kind="error">Номер WhatsApp не указан в настройках. Менеджер увидит заявку в CRM.</Notice>}</div> : <form onSubmit={async event => {
    event.preventDefault(); if (pending) return;
    const form = new FormData(event.currentTarget);
    const institution = String(form.get("institution") || "").trim();
    const contactName = `${form.get("last") || ""} ${form.get("first") || ""}`.trim();
    const phone = String(form.get("phone") || "").trim();
    const note = String(form.get("note") || "").trim();
    setPending(true); setError("");
    try {
      await submitCatalogInquiry({ token, requestKey: key.current, institution, contactName, phone, itemIds: items.map(item => item.id), note });
      const url = catalogWhatsAppUrl(whatsapp, { institution, contactName, phone, note, items });
      setDone(true); setDoneUrl(url);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (reason) { setError(humanError(reason)); }
    finally { setPending(false); }
  }}><fieldset disabled={pending}><label>Школа или детский сад<input ref={firstField} name="institution" required minLength={2} maxLength={200} placeholder="Название, номер и населённый пункт" /></label><div className="catalog-inquiry-name"><label>Фамилия<input name="last" autoComplete="family-name" required maxLength={80}/></label><label>Имя<input name="first" autoComplete="given-name" required maxLength={79}/></label></div><label>Телефон<input name="phone" type="tel" inputMode="tel" autoComplete="tel" required pattern="[+0-9 ()\-]{10,25}" placeholder="+7 900 000-00-00"/></label><label>Комментарий<textarea name="note" rows={3} maxLength={1000} placeholder="Класс или группа, количество детей, пожелания"/></label><label className="catalog-inquiry-consent"><input type="checkbox" required/> Разрешаю связаться со мной по поводу этой заявки</label>{error && <Notice kind="error">{error}</Notice>}<button className="button button-primary button-wide" disabled={!items.length || pending}>{pending ? "Сохраняем…" : "Отправить в WhatsApp"}</button></fieldset></form>}</section></div>;
}
