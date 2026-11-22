/**
 * הפעלת גרסת ההדגמה (נטען רק בבנייה עם VITE_DEMO=true - ראו main.jsx).
 *
 * 1. מתקין את "השרת" שבדפדפן (backend.js).
 * 2. בביקור הראשון מכניס אוטומטית את החקלאי לדוגמה, כדי שמי שפותח את הקישור יראה מיד את המערכת.
 *    אחרי התנתקות הוא נשאר מנותק; בהדגמה אפשר להתחבר עם כל אימייל וסיסמה.
 * 3. מחזיר את פס ההדגמה שמוצג בראש כל מסך.
 */

import { API_URL, tokenStore } from "../api/client";
import { DEMO_TOKEN, installDemoBackend } from "./backend";
import { DemoBanner } from "./DemoBanner";

const VISITED_KEY = "cropguard.demo.visited";

/** מתקין את ההדגמה ומחזיר את הפס שמוצג למעלה */
export function startDemo() {
  const backend = installDemoBackend(API_URL);

  let firstVisit = true;
  try {
    firstVisit = localStorage.getItem(VISITED_KEY) === null;
    localStorage.setItem(VISITED_KEY, "1");
  } catch {
    // אחסון חסום - מתנהגים כמו בביקור ראשון
  }
  if (firstVisit && !tokenStore.get()) tokenStore.set(DEMO_TOKEN);

  const reset = () => {
    backend.reset();
    tokenStore.set(DEMO_TOKEN);
    window.location.hash = "#/fields";
    window.location.reload();
  };

  return <DemoBanner onReset={reset} />;
}
