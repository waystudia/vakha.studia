import { BookOpen, Building2, ClipboardList, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { signOut } from "../lib/repository";

export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <div className="admin-shell">
      <button className="mobile-menu" type="button" onClick={() => setOpen(true)} aria-label="Открыть меню"><Menu /></button>
      {open && <button className="sidebar-scrim" onClick={close} aria-label="Закрыть меню" />}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark">VS</div>
          <div><strong>Vakha Studio</strong><small>Заявки родителей</small></div>
          <button className="sidebar-close" type="button" onClick={close}><X /></button>
        </div>
        <nav>
          <NavLink to="/admin/schools" onClick={close}><Building2 size={20} />Школы</NavLink>
          <NavLink to="/admin/catalog" onClick={close}><BookOpen size={20} />Каталог услуг</NavLink>
          <NavLink to="/admin/orders" onClick={close}><ClipboardList size={20} />Заявки</NavLink>
        </nav>
        <div className="sidebar-note">
          <span>Модуль Photo CRM</span>
          <small>Сбор заявок родителей</small>
        </div>
        <button className="logout-button" type="button" onClick={() => void signOut()}><LogOut size={18} />Выйти</button>
      </aside>
      <main className="admin-main"><Outlet /></main>
    </div>
  );
}
