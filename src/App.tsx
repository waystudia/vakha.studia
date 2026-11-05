import type { Session } from "@supabase/supabase-js";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AdminLayout } from "./components/AdminLayout";
import { Loader } from "./components/ui";
import { ensureDemoData } from "./lib/repository";
import { supabase } from "./lib/supabase";
import { LoginPage } from "./pages/LoginPage";
import { PublicOrderPage } from "./pages/PublicOrderPage";
import { OfflineCatalogPage } from "./pages/OfflineCatalogPage";
import { AdminCatalogViewPage } from "./pages/AdminCatalogViewPage";
import { PublicCatalogPage } from "./pages/PublicCatalogPage";
import { PublicOrderDetailsPage } from "./pages/PublicOrderDetailsPage";

const SchoolsPage = lazy(() => import("./pages/SchoolsPage").then((module) => ({ default: module.SchoolsPage })));
const SchoolPage = lazy(() => import("./pages/SchoolPage").then((module) => ({ default: module.SchoolPage })));
const ClassPage = lazy(() => import("./pages/ClassPage").then((module) => ({ default: module.ClassPage })));
const CatalogPage = lazy(() => import("./pages/CatalogPage").then((module) => ({ default: module.CatalogPage })));
const OrdersPage = lazy(() => import("./pages/OrdersPage").then((module) => ({ default: module.OrdersPage })));
const ProfilePage = lazy(() => import("./pages/ProfilePage").then((module) => ({ default: module.ProfilePage })));

function Protected({ session, children }: { session: Session | null; children: React.ReactNode }) {
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const location = useLocation();
  // The installed public catalog must never wait for an administrator session.
  if (location.pathname === "/offline-catalog" || location.pathname.startsWith("/catalog/")) return <Routes><Route path="/offline-catalog" element={<OfflineCatalogPage />} /><Route path="/catalog/:token" element={<PublicCatalogPage />} /></Routes>;
  return <AdminApp />;
}

function AdminApp() {
  const [session, setSession] = useState<Session | null>(null); const [ready, setReady] = useState(false); const [seeded, setSeeded] = useState<string | null>(null);
  const seedingUserId = useRef<string | null>(null);
  useEffect(() => { void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); }); const { data } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setReady(true); }); return () => data.subscription.unsubscribe(); }, []);
  useEffect(() => { if (!session || seeded === session.user.id || seedingUserId.current === session.user.id) return; seedingUserId.current = session.user.id; void ensureDemoData(session.user.id).then(() => setSeeded(session.user.id)).catch((error) => { seedingUserId.current = null; console.error("Demo seed failed", error); }); }, [session, seeded]);
  if (!ready) return <div className="app-loader"><Loader label="Проверяем вход…"/></div>;
  return <Suspense fallback={<div className="app-loader"><Loader label="Открываем раздел…"/></div>}><Routes><Route path="/login" element={<LoginPage session={session}/>}/><Route path="/p/:token" element={<PublicOrderPage/>}/><Route path="/catalog/:token" element={<PublicCatalogPage/>}/><Route path="/order/:token" element={<PublicOrderDetailsPage/>}/><Route path="/admin/presentation" element={<Protected session={session}><AdminCatalogViewPage userId={session?.user.id || ""} presentation /></Protected>} /><Route path="/admin/public-catalog" element={<Protected session={session}><AdminCatalogViewPage userId={session?.user.id || ""} /></Protected>} /><Route path="/admin" element={<Protected session={session}><AdminLayout/></Protected>}><Route index element={<Navigate to="schools" replace/>}/><Route path="schools" element={<SchoolsPage/>}/><Route path="schools/:schoolId" element={<SchoolPage/>}/><Route path="classes/:classId" element={<ClassPage/>}/><Route path="catalog" element={<CatalogPage userId={session?.user.id || ""}/>}/><Route path="orders" element={<OrdersPage/>}/><Route path="profile" element={<ProfilePage userId={session?.user.id || ""}/>}/></Route><Route path="*" element={<Navigate to={session ? "/admin/schools" : "/login"} replace/>}/></Routes></Suspense>;
}
