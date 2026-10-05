import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useDueCount } from "./lib/review";
import { paperRequestUrl } from "./lib/requests";
import Logo from "./components/Logo";
import StorageStatus from "./components/StorageStatus";
import { Suspense } from "react";

export default function App() {
  const location = useLocation();
  const isReader = location.pathname.startsWith("/paper/");
  const dueCount = useDueCount();

  return (
    <div className="app-shell">
      <StorageStatus />
      {!isReader && (
        <header className="app-header">
          <Link to="/" className="app-title">
            <Logo className="app-logo" />
            <span>
              paper <span className="app-title-accent">reader</span>
            </span>
          </Link>
          <NavLink to="/catalog" className="app-nav-link app-nav-catalog">
            Catalogo
          </NavLink>
          <a
            className="app-nav-link app-nav-request"
            href={paperRequestUrl()}
            target="_blank"
            rel="noopener noreferrer"
          >
            Richiedi un paper
          </a>
          <NavLink to="/review" className="app-nav-link app-nav-review">
            Ripasso
            {dueCount > 0 && <span className="app-nav-badge">{dueCount}</span>}
          </NavLink>
        </header>
      )}
      <main className={isReader ? "app-main app-main-flush" : "app-main"}>
        <Suspense fallback={<p className="state-message">Caricamento…</p>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
