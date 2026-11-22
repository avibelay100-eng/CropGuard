/**
 * מפת המסכים של האפליקציה.
 * /login ו-/register פתוחים לכולם; כל השאר דורשים התחברות.
 */

import { Link, Navigate, Route, Routes } from "react-router";

import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { LoginPage, RegisterPage } from "./pages/AuthPages";
import { FieldsPage } from "./pages/FieldsPage";
import { HistoryPage } from "./pages/HistoryPage";
import { ScanPage } from "./pages/ScanPage";

function NotFoundPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold">הדף לא נמצא</h1>
      <Link to="/scan" className="mt-4 inline-block font-semibold text-leaf underline underline-offset-4">
        חזרה לסריקה
      </Link>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/scan" replace />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/fields" element={<FieldsPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
