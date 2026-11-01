import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
const App = lazy(() => import.meta.env.VITE_CRM_MODE === "true" ? import("./CrmApp") : import("./App"));
import "./styles.css";
import "./public-catalog-media.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Suspense fallback={<main className="public-page">Загрузка…</main>}><App/></Suspense>
    </BrowserRouter>
  </StrictMode>,
);
