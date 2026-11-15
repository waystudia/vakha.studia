import { Camera, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";

import { humanError } from "../lib/helpers";
import { signIn, signUp } from "../lib/repository";
import { Notice } from "../components/ui";

export function LoginPage({ session }: { session: {user:{id:string}} | null }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (session) return <Navigate to="/admin/schools" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const email = String(form.get("email") || "").trim();
      const password = String(form.get("password") || "");
      if (password.length < (import.meta.env.VITE_CRM_MODE === "true" ? 12 : 8)) throw new Error(`Пароль должен содержать минимум ${import.meta.env.VITE_CRM_MODE === "true" ? 12 : 8} символов`);
      if (mode === "signup") {
        const result = await signUp(email, password, String(form.get("fullName") || "").trim());
        if (!result.session) setMessage("Аккаунт создан. Подтвердите почту по письму Supabase и войдите.");
      } else {
        await signIn(email, password);
      }
    } catch (reason) {
      setError(humanError(reason));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-visual">
        <div className="login-brand"><span className="brand-mark">VS</span>Vakha Studio</div>
        <div className="login-copy">
          <span className="eyebrow">PHOTO CRM · МОДУЛЬ ЗАЯВОК</span>
          <h1>Школьные фотозаказы без бумажных списков</h1>
          <p>Создайте школу и класс, отправьте ссылку учителю и получите готовые заявки родителей.</p>
        </div>
        <div className="login-camera"><Camera size={72} /><span>Хорошие воспоминания начинаются здесь</span></div>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <h2>{mode === "login" ? "Вход администратора" : "Создать аккаунт"}</h2>
          <p>{mode === "login" ? "Управляйте школами, классами и заявками" : "Первый аккаунт станет администратором своих данных"}</p>
          {message && <Notice>{message}</Notice>}
          {error && <Notice kind="error">{error}</Notice>}
          <form onSubmit={submit}>
            {mode === "signup" && <label>Ваше имя<input name="fullName" required placeholder="Ваха" autoComplete="name" /></label>}
            <label>{import.meta.env.VITE_CRM_MODE === "true" ? "Логин CRM" : "Электронная почта"}<div className="input-with-icon"><Mail size={18} /><input name="email" type={import.meta.env.VITE_CRM_MODE === "true" ? "text" : "email"} required placeholder="admin@example.ru" autoComplete="email" /></div></label>
            <label>Пароль<div className="input-with-icon"><LockKeyhole size={18} /><input name="password" type="password" required minLength={import.meta.env.VITE_CRM_MODE === "true" ? 12 : 8} placeholder={import.meta.env.VITE_CRM_MODE === "true" ? "Минимум 12 символов" : "Минимум 8 символов"} autoComplete={mode === "login" ? "current-password" : "new-password"} /></div></label>
            <button className="button button-primary button-wide" type="submit" disabled={pending}>{pending && <LoaderCircle className="spin" size={18} />}{mode === "login" ? "Войти" : "Создать аккаунт"}</button>
          </form>
          {import.meta.env.VITE_CRM_MODE !== "true" && <button className="text-button" type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setMessage(""); }}>
            {mode === "login" ? "Нет аккаунта? Создать" : "Уже есть аккаунт? Войти"}
          </button>}
        </div>
      </section>
    </main>
  );
}
