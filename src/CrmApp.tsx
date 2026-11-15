import { lazy,Suspense,useEffect } from 'react';
import {Loader} from './components/ui';
import {currentUser} from './lib/repository';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { CrmCatalogPage } from './pages/CrmCatalogPage';
import { PublicOrderPage } from './pages/PublicOrderPage';
import { PublicOrderDetailsPage } from './pages/PublicOrderDetailsPage';
const CrmAdminApp=lazy(()=>import('./CrmAdminApp'));
function CrmHome(){
 const navigate=useNavigate();
 useEffect(()=>{let alive=true;void currentUser().then(actor=>{const role=String((actor as unknown as {role?:string})?.role||actor?.app_metadata?.role||'');if(alive&&actor&&['admin','manager'].includes(role))navigate('/admin/schools',{replace:true});}).catch(()=>undefined);return()=>{alive=false;};},[navigate]);
 return <CrmCatalogPage/>;
}
export default function CrmApp() {
  const location=useLocation();
  if(location.pathname.startsWith('/admin')||location.pathname==='/login')return <Suspense fallback={<Loader label="Открываем вход…"/>}><CrmAdminApp/></Suspense>;
  return <Routes><Route path="/" element={<CrmHome/>}/><Route path="/catalog" element={<CrmCatalogPage/>}/><Route path="/catalog/:token" element={<CrmCatalogPage/>}/><Route path="/p/:token" element={<PublicOrderPage/>}/><Route path="/order/:token" element={<PublicOrderDetailsPage/>}/><Route path="*" element={<main className="public-page"><div className="public-shell"><header className="public-header"><div className="public-logo"><span className="brand-mark">VS</span><div><strong>Vakha Studio</strong><small>Заказ фотографий и видео</small></div></div></header><section className="public-error"><h1>Откройте ссылку вашего класса</h1><p>Получите ссылку или QR-код у фотографа или учителя. Затем выберите ребёнка и услуги.</p></section></div></main>}/></Routes>;
}
