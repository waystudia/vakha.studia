import { useRef, useState, type FormEvent } from 'react';
import { addPublicChild } from '../lib/publicRepository';
import { similarChildren } from '../lib/childNames';
import { humanError } from '../lib/helpers';
import type { PublicClassPayload } from '../lib/types';
import './public-child-registration.css';
type PublicChild = PublicClassPayload['children'][number];
export function PublicChildRegistration({ token, children, onSaved, onChoose }: { token: string; children: PublicChild[]; onSaved: (child: PublicChild) => void; onChoose: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [first, setFirst] = useState(''); const [last, setLast] = useState('');
  const [pending, setPending] = useState(false); const [error, setError] = useState('');
  const [saved, setSaved] = useState<PublicChild | null>(null);
  const busy = useRef(false); const lastInput = useRef<HTMLInputElement>(null);
  const matches = similarChildren(children, `${last} ${first}`);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy.current) return;
    busy.current = true; setPending(true); setError('');
    try {
      const result = await addPublicChild({ token, firstName: first.trim(), lastName: last.trim() });
      onSaved(result.child); setSaved(result.child); setFirst(''); setLast('');
    } catch (reason) { setError(humanError(reason)); }
    finally { busy.current = false; setPending(false); }
  }
  if (!open) return <div className="public-child-registration"><button type="button" className="button button-secondary" onClick={() => setOpen(true)}>+ Добавить ребёнка</button><p>Родитель может добавить своего ребёнка, учитель — весь класс.</p></div>;
  return <section className="public-child-registration" aria-label="Добавление ребёнка">
    <div className="registration-heading"><h2>Добавить ребёнка</h2><button type="button" className="button button-ghost" disabled={pending} onClick={() => setOpen(false)}>Закрыть</button></div>
    {saved ? <div role="status"><p><strong>{saved.public_name}</strong> — в списке класса.</p><div className="registration-actions"><button type="button" className="button button-primary" onClick={() => onChoose(saved.id)}>Выбрать ребёнка и открыть каталог</button><button type="button" className="button button-secondary" onClick={() => { setSaved(null); requestAnimationFrame(() => lastInput.current?.focus()); }}>Добавить ещё ребёнка</button></div></div> : <form onSubmit={submit}>
      <p>Укажите фамилию и имя. Заявку оформлять не обязательно.</p>
      <div className="registration-fields"><label>Фамилия<input ref={lastInput} autoFocus autoComplete="off" required maxLength={100} value={last} onChange={event => setLast(event.target.value)} placeholder="Абдуллаев" disabled={pending}/></label><label>Имя<input autoComplete="off" required maxLength={100} value={first} onChange={event => setFirst(event.target.value)} placeholder="Адам" disabled={pending}/></label></div>
      {matches.length > 0 && <div className="registration-matches"><p>В списке есть похожие имена. Если это ваш ребёнок, выберите его:</p>{matches.map(child => <button key={child.id} type="button" className="button button-secondary" disabled={pending} onClick={() => onChoose(child.id)}>{child.public_name} · Выбрать</button>)}</div>}
      {error && <p role="alert">{error}</p>}
      <button className="button button-primary" disabled={pending || !first.trim() || !last.trim()}>{pending ? 'Добавляем…' : matches.length ? 'Добавить нового ребёнка' : 'Добавить в список'}</button>
    </form>}
  </section>;
}
