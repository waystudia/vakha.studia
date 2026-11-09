import { Component, StrictMode, lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
const App = lazy(() => import.meta.env.VITE_CRM_MODE === "true" ? import("./CrmApp") : import("./App"));
import "./styles.css";
import "./public-catalog-media.css";

function ConnectionHelp() {
  return <main className="public-page"><section className="public-shell"><h1>Не удалось загрузить страницу</h1><p>Проверьте интернет. Если сайт недоступен без VPN, включите VPN. Если он уже включён, выключите и включите его снова, затем повторите загрузку.</p><button className="button button-primary" onClick={() => window.location.reload()}>Повторить загрузку</button></section></main>;
}
function Loading() {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setSlow(true), 12000); return () => window.clearTimeout(timer); }, []);
  return slow ? <ConnectionHelp /> : <main className="public-page" role="status">Загружаем страницу…</main>;
}
class LoadBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = {failed: false};
  static getDerivedStateFromError() { return {failed: true}; }
  render() { return this.state.failed ? <ConnectionHelp /> : this.props.children; }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <LoadBoundary><Suspense fallback={<Loading />}><App/></Suspense></LoadBoundary>
    </BrowserRouter>
  </StrictMode>,
);
