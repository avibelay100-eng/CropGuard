/**
 * אמון גם בתעודות האבטחה של מערכת ההפעלה (Windows / macOS), ולא רק ברשימה המובנית של Node.
 *
 * למה: אנטי-וירוס (Avast, Kaspersky, ESET...) ורשתות ארגוניות "סורקים" תעבורת HTTPS וחותמים אותה
 * מחדש בתעודה משלהם. Windows סומך על התעודה הזו - Node כברירת מחדל לא, ולכן כל פנייה החוצה
 * (למשל להזנות החדשות) נכשלת ב-"unable to verify the first certificate".
 *
 * זה לא מבטל בדיקת תעודות - רק מוסיף את מה שמערכת ההפעלה כבר סומכת עליו.
 * (לעולם לא NODE_TLS_REJECT_UNAUTHORIZED=0 - זה מבטל את האבטחה לגמרי.)
 *
 * חייב להיטען לפני כל בקשת רשת, ולכן הוא הייבוא הראשון ב-server.js.
 */

import tls from "node:tls";

// הפונקציות קיימות מ-Node 23/24; בגרסה ישנה יותר - פשוט לא עושים כלום
if (typeof tls.getCACertificates === "function" && typeof tls.setDefaultCACertificates === "function") {
  try {
    const merged = new Set([...tls.getCACertificates("default"), ...tls.getCACertificates("system")]);
    tls.setDefaultCACertificates([...merged]);
  } catch (err) {
    console.warn("Could not load system CA certificates:", (err).message);
  }
}
