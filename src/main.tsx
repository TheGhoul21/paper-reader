import { lazy, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import Library from "./pages/Library";
import Home from "./pages/Home";
import "./index.css";

const Reader = lazy(() => import("./pages/Reader"));
const Review = lazy(() => import("./pages/Review"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* basename: the Pages build lives under /paper-reader/ (vite.config.ts `base`). */}
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route element={<App />}>
          <Route index element={<Home />} />
          <Route path="catalog" element={<Library />} />
          <Route path="paper/:slug" element={<Reader />} />
          <Route path="review" element={<Review />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
