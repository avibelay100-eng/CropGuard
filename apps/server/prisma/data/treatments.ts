/**
 * החומרים הפעילים המומלצים לכל מחלה שמודל ה-AI מזהה.
 *
 * מקור: חומרים פעילים מקובלים בהנחיות שירותי הדרכה חקלאית (University of Minnesota
 * Extension, NC State Extension, Clemson HGIC ועוד - אותם מקורות של diseases.xml
 * בפרויקט המקורי). זהו מידע כללי ולא המלצת ריסוס:
 * לפני שימוש יש לוודא שהתכשיר רשום בישראל לגידול ולמחלה (משרד החקלאות - שה"מ / הגנת הצומח),
 * ולפעול לפי התווית ובהתייעצות עם מדריך.
 *
 * 12 התוויות של עלה בריא (*___Healthy) לא מופיעות כאן, כי אין להן טיפול.
 */

export interface TreatmentSeed {
  /** תווית המחלה כפי שהיא ב-labels-38.txt */
  modelLabel: string;
  /** חומרים פעילים (שמות כמו ב-productPrices.ts); ריק אם אין טיפול כימי */
  activeIngredients: string[];
  chemicalControl: boolean;
  /** הנחיה קצרה בעברית */
  note: string;
}

// הערה שחוזרת בכל מחלה שיש לה טיפול כימי
const CONSULT = "יש לוודא רישום התכשיר לגידול ולפעול לפי התווית ובהתייעצות עם מדריך.";

/** ההמלצות לכל 26 המחלות. מחלה בלי טיפול כימי (וירוסים, HLB, אסקה) - רשימה ריקה והנחיה בלבד */
export const TREATMENTS: readonly TreatmentSeed[] = [
  // --- תפוח ---
  {
    modelLabel: "Apple___Apple_scab",
    activeIngredients: ["captan", "myclobutanil", "mancozeb"],
    chemicalControl: true,
    note: `גרב התפוח: לפנות עלים ופירות נגועים ולשפר אוורור. טיפול מונע בתקופות רטובות. ${CONSULT}`,
  },
  {
    modelLabel: "Apple___Black_rot",
    activeIngredients: ["captan"],
    chemicalControl: true,
    note: `ריקבון שחור: להסיר פירות מיובשים וענפים נגועים בכלים נקיים. ${CONSULT}`,
  },
  {
    modelLabel: "Apple___Cedar_apple_rust",
    activeIngredients: ["myclobutanil"],
    chemicalControl: true,
    note: `חלדון ארז-תפוח: טיפול מונע בלבד, בעיתוי הצימוח הרגיש. ${CONSULT}`,
  },
  // --- דובדבן ---
  {
    modelLabel: "Cherry___Powdery_mildew",
    activeIngredients: ["sulfur", "myclobutanil"],
    chemicalControl: true,
    note: `קימחון: לשפר אוורור הנוף ולהגן על צימוח צעיר. ${CONSULT}`,
  },
  // --- תירס ---
  {
    modelLabel: "Corn___Cercospora_leaf_spot Gray_leaf_spot",
    activeIngredients: ["azoxystrobin", "pyraclostrobin", "propiconazole"],
    chemicalControl: true,
    note: `כתמת עלים אפורה: לסקור כמה צמחים סביב עלה השיבולת לפני החלטה על ריסוס. ${CONSULT}`,
  },
  {
    modelLabel: "Corn___Common_rust",
    activeIngredients: ["azoxystrobin", "propiconazole"],
    chemicalControl: true,
    note: `חלדון מצוי: בשדות רבים אין צורך בטיפול; לרסס רק אם הלחץ והשלב מצדיקים. ${CONSULT}`,
  },
  {
    modelLabel: "Corn___Northern_Leaf_Blight",
    activeIngredients: ["azoxystrobin", "pyraclostrobin", "propiconazole"],
    chemicalControl: true,
    note: `כתמת עלים צפונית: לסקור כמה מוקדים בשדה ולהעריך סיכון ליבול. ${CONSULT}`,
  },
  // --- גפן ---
  {
    modelLabel: "Grape___Black_rot",
    activeIngredients: ["mancozeb", "myclobutanil"],
    chemicalControl: true,
    note: `ריקבון שחור: להסיר ענבים מיובשים ושריגים נגועים ולפתוח את הנוף. ${CONSULT}`,
  },
  {
    modelLabel: "Grape___Esca_(Black_Measles)",
    activeIngredients: [],
    chemicalControl: false,
    note: "אסקה: מחלת עצה - אין ריסוס עלווה שמרפא. לסמן גפנים נגועות ולהתייעץ עם מדריך על גיזום, הרכבה מחדש או החלפה.",
  },
  {
    modelLabel: "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
    activeIngredients: ["mancozeb", "copper hydroxide"],
    chemicalControl: true,
    note: `כתמת עלים: לוודא חומרה לפני ריסוס; כתמים מעטים לא תמיד פוגעים ביבול. ${CONSULT}`,
  },
  // --- תפוז ---
  {
    modelLabel: "Orange___Haunglongbing_(Citrus_greening)",
    activeIngredients: [],
    chemicalControl: false,
    note: "ירוקת ההדרים (HLB): אין ריפוי. לדווח מיד לשירותים להגנת הצומח, לא להעביר עצים או חומר ריבוי, ולפעול לפי הנחיות רשמיות.",
  },
  // --- אפרסק ---
  {
    modelLabel: "Peach___Bacterial_spot",
    activeIngredients: ["copper hydroxide"],
    chemicalControl: true,
    note: `כתמת חיידקית: טיפול מונע בלבד - נחושת לא מרפאת רקמה נגועה. ${CONSULT}`,
  },
  // --- פלפל ---
  {
    modelLabel: "Pepper,_bell___Bacterial_spot",
    activeIngredients: ["copper hydroxide"],
    chemicalControl: true,
    note: `כתמת חיידקית: לא לעבוד בצמחים רטובים, לעקור צמחים פגועים קשה. טיפול מונע בלבד. ${CONSULT}`,
  },
  // --- תפוח אדמה ---
  {
    modelLabel: "Potato___Early_blight",
    activeIngredients: ["chlorothalonil", "mancozeb", "azoxystrobin", "difenoconazole"],
    chemicalControl: true,
    note: `כתמת עלים מוקדמת (אלטרנריה): להפחית עקה ולהימנע מהרטבת העלווה. ${CONSULT}`,
  },
  {
    modelLabel: "Potato___Late_blight",
    activeIngredients: ["metalaxyl-m + mancozeb", "cymoxanil + mancozeb", "mandipropamid"],
    chemicalControl: true,
    note: `כימשון: מחלה מתפשטת במהירות - לפנות למדריך מיד, להשמיד צמחים נגועים ולהגן על הבריאים. ${CONSULT}`,
  },
  // --- דלעת ---
  {
    modelLabel: "Squash___Powdery_mildew",
    activeIngredients: ["sulfur", "myclobutanil"],
    chemicalControl: true,
    note: `קימחון: הגנה מוקדמת על רקמה בריאה יעילה יותר מטיפול במושבות קיימות. ${CONSULT}`,
  },
  // --- תות שדה ---
  {
    modelLabel: "Strawberry___Leaf_scorch",
    activeIngredients: ["captan"],
    chemicalControl: true,
    note: `חריכת עלים: נגיעות קלה לא תמיד מצדיקה ריסוס; לשפר אוורור ולהשקות בטפטוף. ${CONSULT}`,
  },
  // --- עגבנייה ---
  {
    modelLabel: "Tomato___Bacterial_spot",
    activeIngredients: ["copper hydroxide"],
    chemicalControl: true,
    note: `כתמת חיידקית: להפחית התזות מים ולעקור צמחים פגועים קשה. טיפול מונע בלבד. ${CONSULT}`,
  },
  {
    modelLabel: "Tomato___Early_blight",
    activeIngredients: ["chlorothalonil", "mancozeb", "azoxystrobin", "difenoconazole"],
    chemicalControl: true,
    note: `כתמת עלים מוקדמת (אלטרנריה): להסיר מעט עלים תחתונים פגועים, לחפות ולהשקות לקרקע. ${CONSULT}`,
  },
  {
    modelLabel: "Tomato___Late_blight",
    activeIngredients: ["metalaxyl-m + mancozeb", "cymoxanil + mancozeb", "mandipropamid"],
    chemicalControl: true,
    note: `כימשון: לפנות למדריך מיד ולסלק צמחים נגועים; גיזום עלים בודדים אינו מספיק. ${CONSULT}`,
  },
  {
    modelLabel: "Tomato___Leaf_Mold",
    activeIngredients: ["chlorothalonil", "difenoconazole"],
    chemicalControl: true,
    note: `עובש עלים: להוריד לחות באוורור, מרווחים והשקיה לקרקע. ${CONSULT}`,
  },
  {
    modelLabel: "Tomato___Septoria_leaf_spot",
    activeIngredients: ["chlorothalonil", "mancozeb"],
    chemicalControl: true,
    note: `כתמת ספטוריה: להסיר עלים תחתונים פגועים ולחפות נגד התזות. ${CONSULT}`,
  },
  {
    modelLabel: "Tomato___Spider_mites Two-spotted_spider_mite",
    activeIngredients: ["abamectin"],
    chemicalControl: true,
    note: `אקרית אדומה מצויה: להפחית עקת מים ולשמור על אקריות טורפות; תכשירים רחבי טווח עלולים להחמיר. ${CONSULT}`,
  },
  {
    modelLabel: "Tomato___Target_Spot",
    activeIngredients: ["chlorothalonil", "azoxystrobin"],
    chemicalControl: true,
    note: `כתמת מטרה: לשפר ייבוש הנוף ולפנות שאריות נגועות. ${CONSULT}`,
  },
  {
    modelLabel: "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
    activeIngredients: [],
    chemicalControl: false,
    note: "צהבון אמיר העגבנייה (TYLCV): אין תכשיר שמרפא צמח נגוע. לעקור צמחים נגועים מוקדם ולתאם עם מדריך הדברה של כנימת העש (הווקטור).",
  },
  {
    modelLabel: "Tomato___Tomato_mosaic_virus",
    activeIngredients: [],
    chemicalControl: false,
    note: "וירוס מוזאיקת העגבנייה: אין ריפוי. לעבוד בצמחים חשודים אחרונים, לחטא ידיים וכלים ולסלק חומר נגוע בזהירות.",
  },
];
