/**
 * מסגרת האפליקציה למשתמש מחובר: כותרת עליונה, ניווט (בטלפון - סרגל תחתון), ותוכן.
 */

import { NavLink, Outlet } from "react-router";

import { useAuth } from "../auth/AuthContext";
import { ROLE_LABELS_HE } from "../lib/format";

const NAV_ITEMS = [
  { to: "/scan", label: "סריקה", icon: "M12 4v16M4 12h16" },
  { to: "/fields", label: "חלקות", icon: "M4 6h16M4 12h16M4 18h16" },
  { to: "/history", label: "היסטוריה", icon: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" },
] as const;

function NavItems({ variant }: { variant: "top" | "bottom" }) {
  return (
    <>
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            variant === "top"
              ? `border-b-2 px-1 py-4 font-medium ${isActive ? "border-leaf text-leaf" : "border-transparent text-soil hover:text-ink"}`
              : `flex flex-1 flex-col items-center gap-0.5 py-2 text-sm ${isActive ? "text-leaf" : "text-soil"}`
          }
        >
          {variant === "bottom" && (
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d={item.icon} />
            </svg>
          )}
          {item.label}
        </NavLink>
      ))}
    </>
  );
}

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-8">
            <NavLink to="/scan" className="flex items-center gap-2 py-3 font-display text-2xl font-bold text-leaf">
              <img src="/leaf.svg" alt="" className="size-7" />
              CropGuard
            </NavLink>
            <nav aria-label="ניווט ראשי" className="hidden gap-6 sm:flex">
              <NavItems variant="top" />
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {user && (
              <span className="hidden text-soil sm:inline">
                {user.name} ({ROLE_LABELS_HE[user.role]})
              </span>
            )}
            <button type="button" onClick={logout} className="cursor-pointer text-soil underline underline-offset-4 hover:text-ink">
              התנתקות
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-8 pb-28 sm:pb-12">
        <Outlet />
      </main>

      {/* בטלפון: ניווט תחתון, קרוב לאגודל */}
      <nav aria-label="ניווט ראשי" className="fixed inset-x-0 bottom-0 flex border-t border-line bg-white sm:hidden">
        <NavItems variant="bottom" />
      </nav>
    </div>
  );
}
