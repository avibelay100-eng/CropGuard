/**
 * בדיקות לפענוח התוויות ולזיהוי בריא/נגוע.
 */

import { describe, expect, it } from "vitest";

import { defaultSettings } from "../src/config.js";
import { loadLabels, parseLabel } from "../src/labels.js";

describe("parseLabel", () => {
  it.each([
    ["Tomato___Healthy", "Tomato", true, "Tomato Healthy"],
    ["Tomato___Late_blight", "Tomato", false, "Tomato Late blight"],
    ["Pepper,_bell___Bacterial_spot", "Pepper, bell", false, "Pepper, bell Bacterial spot"],
    ["Orange___Haunglongbing_(Citrus_greening)", "Orange", false, "Orange Huanglongbing (Citrus Greening)"],
  ])("%s", (label, plant, isHealthy, displayName) => {
    expect(parseLabel(label)).toEqual({ modelLabel: label, plant, isHealthy, displayName });
  });
});

describe("labels-38.txt", () => {
  it("has 38 unique labels, 12 of them healthy", async () => {
    const labels = await loadLabels(defaultSettings.labelsPath);
    expect(labels).toHaveLength(38);
    expect(labels.filter((label) => parseLabel(label).isHealthy)).toHaveLength(12);
  });
});
