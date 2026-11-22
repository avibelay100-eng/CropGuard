/**
 * ★ התאמה לשוק הישראלי: שמות החומרים הפעילים בעברית, כפי שהם מופיעים על תוויות התכשירים בארץ.
 * המפתח הוא השם באנגלית כפי שהוא ב-ProductPriceRange.activeIngredient.
 */

export const ACTIVE_INGREDIENTS_HE: Readonly<Record<string, string>> = {
  "abamectin": "אבמקטין",
  "azoxystrobin": "אזוקסיסטרובין",
  "captan": "קפטן",
  "chlorothalonil": "כלורותלוניל",
  "copper hydroxide": "נחושת הידרוקסידית",
  "cymoxanil + mancozeb": "סימוקסניל + מנקוזב",
  "difenoconazole": "דיפנוקונזול",
  "mancozeb": "מנקוזב",
  "mandipropamid": "מנדיפרופמיד",
  "metalaxyl-m + mancozeb": "מטלקסיל-M + מנקוזב",
  "myclobutanil": "מיקלובוטניל",
  "propiconazole": "פרופיקונזול",
  "pyraclostrobin": "פירקלוסטרובין",
  "sulfur": "גופרית",
};

/** שם החומר בעברית; אם אין תרגום מוחזר השם באנגלית */
export function activeIngredientHe(name: string): string {
  return ACTIVE_INGREDIENTS_HE[name] ?? name;
}
