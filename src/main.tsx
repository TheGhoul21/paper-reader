import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import Library from "./pages/Library";
import Reader from "./pages/Reader";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* basename: the Pages build lives under /paper-reader/ (vite.config.ts `base`). */}
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route element={<App />}>
          <Route index element={<Library />} />
          <Route path="paper/:slug" element={<Reader />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
