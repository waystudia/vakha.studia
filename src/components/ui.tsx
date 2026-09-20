import type { FormEvent, ReactNode } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, X } from "lucide-react";

export function Loader({ label = "Загрузка…" }: { label?: string }) {
  return (
    <div className="loader" role="status">
      <LoaderCircle className="spin" size={22} />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

export function Notice({ kind = "success", children }: { kind?: "success" | "error" | "info"; children: ReactNode }) {
  return (
    <div className={`notice notice-${kind}`} role={kind === "error" ? "alert" : "status"}>
      {kind === "success" ? <CheckCircle2 size={18} /> : kind === "error" ? <AlertCircle size={18} /> : null}
      <span>{children}</span>
    </div>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Закрыть">
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function FormActions({ pending, submitLabel, onCancel }: { pending: boolean; submitLabel: string; onCancel: () => void }) {
  return (
    <div className="form-actions">
      <button className="button button-secondary" type="button" onClick={onCancel} disabled={pending}>Отмена</button>
      <button className="button button-primary" type="submit" disabled={pending}>
        {pending && <LoaderCircle className="spin" size={17} />}
        {pending ? "Сохраняем…" : submitLabel}
      </button>
    </div>
  );
}

export function handleSubmit(callback: (form: FormData) => Promise<void>) {
  return async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await callback(new FormData(event.currentTarget));
  };
}
