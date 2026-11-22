/**
 * מפת המסכים של האפליקציה.
 * /login ו-/register פתוחים לכולם; כל השאר דורשים התחברות.
 */

import { Link, Navigate, Route, Routes } from "react-router";

import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { AccountPage } from "./pages/AccountPage";
import { LoginPage, RegisterPage } from "./pages/AuthPages";
import { FieldJournalPage } from "./pages/FieldJournalPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { FieldsPage } from "./pages/FieldsPage";
import { HistoryPage } from "./pages/HistoryPage";
import { LibraryPage } from "./pages/LibraryPage";
import { NewsPage } from "./pages/NewsPage";
import { ScanPage } from "./pages/ScanPage";

/** דף לכתובת שלא קיימת בתוך האפליקציה */
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

/** הניתוב: דפי כניסה פתוחים; כל השאר מאחורי RequireAuth ובתוך ה-Layout */
export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/scan" replace />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/fields" element={<FieldsPage />} />
          {/* ★ יומן שדה ו-PHI של חלקה אחת */}
          <Route path="/fields/:fieldId/journal" element={<FieldJournalPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
