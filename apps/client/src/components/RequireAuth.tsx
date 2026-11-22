/**
 * שומר על מסכים פנימיים: משתמש לא מחובר מועבר למסך ההתחברות,
 * ואחרי ההתחברות חוזר למסך שביקש.
 */

import { Navigate, Outlet, useLocation } from "react-router";

import { useAuth } from "../auth/AuthContext";
import { Spinner } from "./ui";

export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner label="טוען…" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
