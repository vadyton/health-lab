import { useState, useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import { NavLink } from "react-router-dom";
import { useStore } from "@/shared/stores/StoreContext";
import s from "./Navbar.module.scss";


const MAIN_LINKS = [
  { to: "/",           label: "Активности", icon: "🏃" },
  { to: "/heart-rate", label: "Пульс",      icon: "❤️" },
  { to: "/body",       label: "Вес",        icon: "⚖️" },
  { to: "/steps",      label: "Шаги",       icon: "👟" },
  { to: "/sleep",      label: "Сон",        icon: "🌙" },
];

const RIGHT_LINKS = [
  { to: "/profile",     label: "Профиль",   icon: "👤" },
  { to: "/file-viewer", label: "Просмотр",  icon: "📂" },
  { to: "/import",      label: "Импорт",    icon: "⬆️" },
];

const ALL_LINKS = [...MAIN_LINKS, ...RIGHT_LINKS];

function BrandIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#ef4444"/>
      <path d="M16 26C12 23 7 19 7 13.5A5.2 5.2 0 0 1 16 10a5.2 5.2 0 0 1 9 3.5C25 19 20 23 16 26Z" fill="rgba(255,255,255,0.18)"/>
      <polyline points="4,16 7.5,16 9.5,11 12,21 14.5,13 16,17.5 18,16 21,16 23,11 26.5,16 28,16"
        stroke="white" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function NavItem({ to, label, icon, end, onClick }: { to: string; label: string; icon: string; end?: boolean; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) => `${s.link} ${isActive ? s.active : ""}`}
    >
      <span className={s.linkIcon}>{icon}</span>
      <span className={s.linkLabel}>{label}</span>
    </NavLink>
  );
}

export const Navbar = observer(() => {
  const { ui, auth } = useStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close drawer on outside click
  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setDrawerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [drawerOpen]);

  // Close drawer on route change
  const closeDrawer = () => setDrawerOpen(false);

  return (
    <>
      <nav className={s.nav}>
        <div className={s.brand}>
          <BrandIcon />
          <span className={s.brandName}>Health Lab</span>
        </div>

        {/* Desktop links */}
        <div className={s.links}>
          {MAIN_LINKS.map(l => <NavItem key={l.to} {...l} end={l.to === "/"} />)}
        </div>
        <div className={s.rightLinks}>
          {RIGHT_LINKS.map(l => <NavItem key={l.to} {...l} />)}
          <button
            className={s.themeBtn}
            onClick={() => ui.toggleTheme()}
            title={ui.theme === "dark" ? "Светлая тема" : "Тёмная тема"}
            aria-label="Переключить тему"
          >
            {ui.theme === "dark" ? "☀️" : "🌙"}
          </button>
          {auth.username && (
            <button className={s.logoutBtn} onClick={() => auth.clear()} title={`Выйти (${auth.username})`}>
              🚪
            </button>
          )}
        </div>

        {/* Mobile burger */}
        <button
          className={s.burger}
          onClick={() => setDrawerOpen(o => !o)}
          aria-label="Открыть меню"
        >
          <span /><span /><span />
        </button>
      </nav>

      {/* Mobile drawer overlay */}
      {drawerOpen && <div className={s.overlay} onClick={closeDrawer} />}

      <div ref={drawerRef} className={`${s.drawer} ${drawerOpen ? s.drawerOpen : ""}`}>
        <div className={s.drawerHeader}>
          <div className={s.brand}>
            <BrandIcon />
            <span className={s.brandName}>Health Lab</span>
          </div>
          <button className={s.themeBtn} onClick={() => ui.toggleTheme()} title="Переключить тему">
            {ui.theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
        <div className={s.drawerLinks}>
          {ALL_LINKS.map(l => (
            <NavItem key={l.to} {...l} end={l.to === "/"} onClick={closeDrawer} />
          ))}
          {auth.username && (
            <button className={`${s.link} ${s.logoutRow}`} onClick={() => { auth.clear(); closeDrawer(); }}>
              <span className={s.linkIcon}>🚪</span>
              <span className={s.linkLabel}>Выйти ({auth.username})</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
});
