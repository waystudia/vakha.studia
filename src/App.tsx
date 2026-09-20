import type { Session } from "@supabase/supabase-js";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "./components/AdminLayout";
import { Loader } from "./components/ui";
import { ensureDemoData } from "./lib/repository";
import { supabase } from "./lib/supabase";
import { LoginPage } from "./pages/LoginPage";
import { PublicOrderPage } from "./pages/PublicOrderPage";

const SchoolsPage = lazy(() => import("./pages/SchoolsPage").then((module) => ({ default: module.SchoolsPage })));
const SchoolPage = lazy(() => import("./pages/SchoolPage").then((module) => ({ default: module.SchoolPage })));
const ClassPage = lazy(() => import("./pages/ClassPage").then((module) => ({ default: module.ClassPage })));
const CatalogPage = lazy(() => import("./pages/CatalogPage").then((module) => ({ default: module.CatalogPage })));
const OrdersPage = lazy(() => import("./pages/OrdersPage").then((module) => ({ default: module.OrdersPage })));

function Protected({ session, children }: { session: Session | null; children: React.ReactNode }) {
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null); const [ready, setReady] = useState(false); const [seeded, setSeeded] = useState<string | null>(null);
  const seedingUserId = useRef<string | null>(null);
  useEffect(() => { void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); }); const { data } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setReady(true); }); return () => data.subscription.unsubscribe(); }, []);
  useEffect(() => { if (!session || seeded === session.user.id || seedingUserId.current === session.user.id) return; seedingUserId.current = session.user.id; void ensureDemoData(session.user.id).then(() => setSeeded(session.user.id)).catch((error) => { seedingUserId.current = null; console.error("Demo seed failed", error); }); }, [session, seeded]);
  if (!ready) return <div className="app-loader"><Loader label="Проверяем вход…"/></div>;
  return <Suspense fallback={<div className="app-loader"><Loader label="Открываем раздел…"/></div>}><Routes><Route path="/login" element={<LoginPage session={session}/>}/><Route path="/p/:token" element={<PublicOrderPage/>}/><Route path="/admin" element={<Protected session={session}><AdminLayout/></Protected>}><Route index element={<Navigate to="schools" replace/>}/><Route path="schools" element={<SchoolsPage/>}/><Route path="schools/:schoolId" element={<SchoolPage/>}/><Route path="classes/:classId" element={<ClassPage/>}/><Route path="catalog" element={<CatalogPage userId={session?.user.id || ""}/>}/><Route path="orders" element={<OrdersPage/>}/></Route><Route path="*" element={<Navigate to={session ? "/admin/schools" : "/login"} replace/>}/></Routes></Suspense>;
}
