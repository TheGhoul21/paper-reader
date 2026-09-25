import { Link, Outlet, useLocation } from "react-router-dom";

export default function App() {
  const location = useLocation();
  const isReader = location.pathname.startsWith("/paper/");

  return (
    <div className="app-shell">
      {!isReader && (
        <header className="app-header">
          <Link to="/" className="app-title">
            paper reader
          </Link>
        </header>
      )}
      <main className={isReader ? "app-main app-main-flush" : "app-main"}>
        <Outlet />
      </main>
    </div>
  );
}
