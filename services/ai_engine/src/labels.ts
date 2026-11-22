/**
 * CropGuard AI Engine - טעינת תוויות המחלות והפיכת תווית גולמית לתוצאה קריאה.
 *
 * כל תווית בנויה כך: "צמח___מצב", למשל "Tomato___Late_blight" או "Apple___Healthy".
 * הסדר בקובץ חייב להיות זהה לסדר הפלט של המודל.
 */

import { readFile } from "node:fs/promises";

export const EXPECTED_CLASS_COUNT = 38;
const LABEL_SEPARATOR = "___";
const HEALTHY_CONDITION = "healthy";

// שמות תצוגה מיוחדים: תיקון שגיאת כתיב במקור ושמות ארוכים מדי
const DISPLAY_OVERRIDES: Readonly<Record<string, string>> = {
  "Orange___Haunglongbing_(Citrus_greening)": "Orange Huanglongbing (Citrus Greening)",
  "Corn___Cercospora_leaf_spot Gray_leaf_spot": "Corn Gray Leaf Spot",
  "Tomato___Spider_mites Two-spotted_spider_mite": "Tomato Two-Spotted Spider Mite",
};

/** קובץ התוויות חסר או לא תואם לחוזה של 38 מחלקות */
export class LabelsError extends Error {
  override name = "LabelsError";
}

export interface LabelInfo {
  modelLabel: string;
  plant: string;
  displayName: string;
  isHealthy: boolean;
}

/** קורא את התוויות לפי סדר הפלט של המודל. שורות ריקות ושורות שמתחילות ב-# מדולגות. */
export async function loadLabels(labelsPath: string): Promise<string[]> {
  let text: string;
  try {
    text = await readFile(labelsPath, "utf-8");
  } catch (err) {
    throw new LabelsError(`Labels file not found: ${labelsPath}`, { cause: err });
  }

  const labels = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));

  if (labels.length !== EXPECTED_CLASS_COUNT) {
    throw new LabelsError(`Expected ${EXPECTED_CLASS_COUNT} labels in ${labelsPath}, found ${labels.length}`);
  }
  if (new Set(labels).size !== labels.length) {
    throw new LabelsError(`Duplicate labels found in ${labelsPath}`);
  }
  return labels;
}

/** מפרק "צמח___מצב" לשם צמח, שם תצוגה ודגל "בריא" */
export function parseLabel(modelLabel: string): LabelInfo {
  const separatorIndex = modelLabel.indexOf(LABEL_SEPARATOR);
  const plantRaw = separatorIndex === -1 ? modelLabel : modelLabel.slice(0, separatorIndex);
  const conditionRaw = separatorIndex === -1 ? "" : modelLabel.slice(separatorIndex + LABEL_SEPARATOR.length);

  const plant = plantRaw.replaceAll("_", " ").trim();
  const condition = conditionRaw.replaceAll("_", " ").trim();
  const displayName = DISPLAY_OVERRIDES[modelLabel] ?? (condition ? `${plant} ${condition}` : plant);

  return {
    modelLabel,
    plant,
    displayName,
    isHealthy: condition.toLowerCase() === HEALTHY_CONDITION,
  };
}
