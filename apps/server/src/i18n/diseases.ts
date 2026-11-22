/**
 * מילון המחלות בעברית: לכל אחת מ-38 התוויות של מודל ה-AI -
 * שם הצמח, שם המחלה בעברית, והשם המדעי של הגורם (פטרייה, חיידק, וירוס או מזיק).
 *
 * המפתח הוא התווית בדיוק כפי שהיא ב-labels-38.txt.
 */

import type { DiseaseInfo } from "@cropguard/shared-types";

interface DiseaseEntry {
  plantHe: string;
  /** שם המחלה בעברית; "בריא" לעלה בריא */
  nameHe: string;
  /** null לעלה בריא */
  scientificName: string | null;
}

const HEALTHY = "בריא";

/**
 * ★ התאמה לשוק הישראלי: מילון 38 התוויות - שם הצמח והמחלה בעברית, והשם המדעי של הגורם.
 * בדיקה אוטומטית (test/i18n.test.ts) מוודאת שהוא מכסה בדיוק את התוויות של המודל.
 */
export const DISEASES: Readonly<Record<string, DiseaseEntry>> = {
  // --- תפוח ---
  "Apple___Apple_scab": { plantHe: "תפוח", nameHe: "גרב התפוח", scientificName: "Venturia inaequalis" },
  "Apple___Black_rot": { plantHe: "תפוח", nameHe: "ריקבון שחור", scientificName: "Diplodia seriata" },
  "Apple___Cedar_apple_rust": {
    plantHe: "תפוח",
    nameHe: "חלדון ארז-תפוח",
    scientificName: "Gymnosporangium juniperi-virginianae",
  },
  "Apple___Healthy": { plantHe: "תפוח", nameHe: HEALTHY, scientificName: null },
  // --- אוכמנית ---
  "Blueberry___Healthy": { plantHe: "אוכמנית", nameHe: HEALTHY, scientificName: null },
  // --- דובדבן ---
  "Cherry___Powdery_mildew": { plantHe: "דובדבן", nameHe: "קימחון", scientificName: "Podosphaera clandestina" },
  "Cherry___Healthy": { plantHe: "דובדבן", nameHe: HEALTHY, scientificName: null },
  // --- תירס ---
  "Corn___Cercospora_leaf_spot Gray_leaf_spot": {
    plantHe: "תירס",
    nameHe: "כתמת עלים אפורה (צרקוספורה)",
    scientificName: "Cercospora zeae-maydis",
  },
  "Corn___Common_rust": { plantHe: "תירס", nameHe: "חלדון מצוי", scientificName: "Puccinia sorghi" },
  "Corn___Northern_Leaf_Blight": { plantHe: "תירס", nameHe: "כתמת עלים צפונית", scientificName: "Exserohilum turcicum" },
  "Corn___Healthy": { plantHe: "תירס", nameHe: HEALTHY, scientificName: null },
  // --- גפן ---
  "Grape___Black_rot": { plantHe: "גפן", nameHe: "ריקבון שחור", scientificName: "Guignardia bidwellii" },
  "Grape___Esca_(Black_Measles)": {
    plantHe: "גפן",
    nameHe: "אסקה (חצבת שחורה)",
    scientificName: "Phaeomoniella chlamydospora",
  },
  "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)": {
    plantHe: "גפן",
    nameHe: "כתמת עלים (איזריופסיס)",
    scientificName: "Pseudocercospora vitis",
  },
  "Grape___Healthy": { plantHe: "גפן", nameHe: HEALTHY, scientificName: null },
  // --- תפוז ---
  "Orange___Haunglongbing_(Citrus_greening)": {
    plantHe: "תפוז",
    nameHe: "ירוקת ההדרים (HLB)",
    scientificName: "Candidatus Liberibacter asiaticus",
  },
  // --- אפרסק ---
  "Peach___Bacterial_spot": { plantHe: "אפרסק", nameHe: "כתמת חיידקית", scientificName: "Xanthomonas arboricola pv. pruni" },
  "Peach___Healthy": { plantHe: "אפרסק", nameHe: HEALTHY, scientificName: null },
  // --- פלפל ---
  "Pepper,_bell___Bacterial_spot": { plantHe: "פלפל", nameHe: "כתמת חיידקית", scientificName: "Xanthomonas euvesicatoria" },
  "Pepper,_bell___Healthy": { plantHe: "פלפל", nameHe: HEALTHY, scientificName: null },
  // --- תפוח אדמה ---
  "Potato___Early_blight": {
    plantHe: "תפוח אדמה",
    nameHe: "כתמת עלים מוקדמת (אלטרנריה)",
    scientificName: "Alternaria solani",
  },
  "Potato___Late_blight": { plantHe: "תפוח אדמה", nameHe: "כימשון", scientificName: "Phytophthora infestans" },
  "Potato___Healthy": { plantHe: "תפוח אדמה", nameHe: HEALTHY, scientificName: null },
  // --- פטל, סויה ---
  "Raspberry___Healthy": { plantHe: "פטל", nameHe: HEALTHY, scientificName: null },
  "Soybean___Healthy": { plantHe: "סויה", nameHe: HEALTHY, scientificName: null },
  // --- דלעת ---
  "Squash___Powdery_mildew": { plantHe: "דלעת", nameHe: "קימחון", scientificName: "Podosphaera xanthii" },
  // --- תות שדה ---
  "Strawberry___Leaf_scorch": { plantHe: "תות שדה", nameHe: "חריכת עלים", scientificName: "Diplocarpon earlianum" },
  "Strawberry___Healthy": { plantHe: "תות שדה", nameHe: HEALTHY, scientificName: null },
  // --- עגבנייה ---
  "Tomato___Bacterial_spot": { plantHe: "עגבנייה", nameHe: "כתמת חיידקית", scientificName: "Xanthomonas spp." },
  "Tomato___Early_blight": {
    plantHe: "עגבנייה",
    nameHe: "כתמת עלים מוקדמת (אלטרנריה)",
    scientificName: "Alternaria solani",
  },
  "Tomato___Late_blight": { plantHe: "עגבנייה", nameHe: "כימשון", scientificName: "Phytophthora infestans" },
  "Tomato___Leaf_Mold": { plantHe: "עגבנייה", nameHe: "עובש עלים", scientificName: "Passalora fulva" },
  "Tomato___Septoria_leaf_spot": { plantHe: "עגבנייה", nameHe: "כתמת ספטוריה", scientificName: "Septoria lycopersici" },
  "Tomato___Spider_mites Two-spotted_spider_mite": {
    plantHe: "עגבנייה",
    nameHe: "אקרית אדומה מצויה",
    scientificName: "Tetranychus urticae",
  },
  "Tomato___Target_Spot": { plantHe: "עגבנייה", nameHe: "כתמת מטרה", scientificName: "Corynespora cassiicola" },
  "Tomato___Tomato_Yellow_Leaf_Curl_Virus": {
    plantHe: "עגבנייה",
    nameHe: "צהבון אמיר העגבנייה (TYLCV)",
    scientificName: "Tomato yellow leaf curl virus",
  },
  "Tomato___Tomato_mosaic_virus": {
    plantHe: "עגבנייה",
    nameHe: "וירוס מוזאיקת העגבנייה",
    scientificName: "Tomato mosaic virus",
  },
  "Tomato___Healthy": { plantHe: "עגבנייה", nameHe: HEALTHY, scientificName: null },
};

/** שם הצמח מתוך תווית: "Pepper,_bell___Bacterial_spot" -> "Pepper, bell" (כמו cropType של חלקה) */
export function plantOfLabel(modelLabel: string): string {
  return (modelLabel.split("___")[0] ?? modelLabel).replaceAll("_", " ");
}

/** שם הצמח בעברית לפי השם באנגלית ("Corn" -> "תירס"); לצמח לא מוכר - השם כמו שהוא */
export function plantHe(plant: string): string {
  const entry = Object.entries(DISEASES).find(([label]) => plantOfLabel(label) === plant);
  return entry ? entry[1].plantHe : plant;
}

/**
 * בונה את פרטי המחלה בעברית ובאנגלית.
 * nameEn מגיע משירות ה-AI (או מהמסד); לתווית לא מוכרת מוחזר השם האנגלי גם בעברית.
 */
export function describeDisease(modelLabel: string, nameEn: string): DiseaseInfo {
  const entry = DISEASES[modelLabel];
  if (!entry) {
    return { modelLabel, plantHe: nameEn, nameHe: nameEn, displayNameHe: nameEn, nameEn, scientificName: null };
  }
  return {
    modelLabel,
    plantHe: entry.plantHe,
    nameHe: entry.nameHe,
    displayNameHe: `${entry.plantHe} – ${entry.nameHe}`,
    nameEn,
    scientificName: entry.scientificName,
  };
}
