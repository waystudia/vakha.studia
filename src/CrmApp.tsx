import { Route, Routes } from 'react-router-dom';
import { PublicOrderPage } from './pages/PublicOrderPage';
import { PublicOrderDetailsPage } from './pages/PublicOrderDetailsPage';
export default function CrmApp() {
  return <Routes><Route path="/p/:token" element={<PublicOrderPage/>}/><Route path="/order/:token" element={<PublicOrderDetailsPage/>}/><Route path="*" element={<main className="public-page"><div className="public-shell"><header className="public-header"><div className="public-logo"><span className="brand-mark">VS</span><div><strong>Vakha Studio</strong><small>Заказ фотографий и видео</small></div></div></header><section className="public-error"><h1>Откройте ссылку вашего класса</h1><p>Получите ссылку или QR-код у фотографа или учителя. Затем выберите ребёнка и услуги.</p></section></div></main>}/></Routes>;
}
