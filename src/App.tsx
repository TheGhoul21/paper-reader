import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useDueCount } from "./lib/review";
import { paperRequestUrl } from "./lib/requests";

export default function App() {
  const location = useLocation();
  const isReader = location.pathname.startsWith("/paper/");
  const dueCount = useDueCount();

  return (
    <div className="app-shell">
      {!isReader && (
        <header className="app-header">
          <Link to="/" className="app-title">
            paper reader
          </Link>
          <a className="app-nav-link app-nav-request" href={paperRequestUrl()} target="_blank" rel="noopener noreferrer">
            Richiedi un paper
          </a>
          <NavLink to="/review" className="app-nav-link app-nav-review">
            Ripasso
            {dueCount > 0 && <span className="app-nav-badge">{dueCount}</span>}
          </NavLink>
        </header>
      )}
      <main className={isReader ? "app-main app-main-flush" : "app-main"}>
        <Outlet />
      </main>
    </div>
  );
}
