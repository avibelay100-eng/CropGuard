/**
 * נקודת הכניסה של אפליקציית CropGuard.
 * הגופנים נטענים מקומית (fontsource) - בלי בקשות לשרתים חיצוניים.
 *
 * גרסת ההדגמה (GitHub Pages): בבנייה עם VITE_DEMO=true נטען גם "שרת" שרץ בדפדפן (src/demo),
 * והניתוב עובר ל-HashRouter (#/fields), כי באתר סטטי אין שרת שיחזיר את האפליקציה לכל כתובת.
 * בבנייה רגילה קוד ההדגמה לא נטען בכלל.
 */

import "@fontsource/ibm-plex-sans-hebrew/400.css";
import "@fontsource/ibm-plex-sans-hebrew/500.css";
import "@fontsource/ibm-plex-sans-hebrew/600.css";
import "@fontsource/frank-ruhl-libre/500.css";
import "@fontsource/frank-ruhl-libre/700.css";
import "@fontsource/ibm-plex-serif/400-italic.css";
import "./index.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router";

import { App } from "./App";
import { AuthProvider } from "./auth/AuthContext";

const DEMO = import.meta.env.VITE_DEMO === "true";

/** מפעיל את האפליקציה; בהדגמה - קודם מתקין את השרת שבדפדפן */
async function start() {
  const banner = DEMO ? (await import("./demo/setup")).startDemo() : null;
  const Router = DEMO ? HashRouter : BrowserRouter;

  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <Router>
        {banner}
        <AuthProvider>
          <App />
        </AuthProvider>
      </Router>
    </StrictMode>,
  );
}

start();
