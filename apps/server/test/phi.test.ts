/**
 * בדיקות יחידה לחישובי התאריכים של PHI (ימי המתנה לקטיף) - בלי מסד נתונים.
 */

import { describe, expect, it } from "vitest";

import { addDays, formatDateOnly, isValidDateOnly, parseDateOnly, safeHarvestDate, todayInIsrael } from "../src/services/phi.js";

describe("PHI date helpers", () => {
  it("adds the waiting days to the spray date", () => {
    expect(safeHarvestDate("2026-11-22", 7)).toBe("2026-11-29");
    expect(safeHarvestDate("2026-11-22", 0)).toBe("2026-11-22");
  });

  it("crosses months, years and leap days", () => {
    expect(addDays("2026-11-28", 3)).toBe("2026-12-01");
    expect(addDays("2026-12-30", 14)).toBe("2027-01-13");
    expect(addDays("2028-02-27", 2)).toBe("2028-02-29");
  });

  it("is not shifted by daylight-saving changes in Israel (late March / late October)", () => {
    expect(addDays("2027-03-24", 7)).toBe("2027-03-31");
    expect(addDays("2026-10-22", 7)).toBe("2026-10-29");
  });

  it("uses the Israeli calendar day for 'today', not UTC", () => {
    // 22:30 UTC on 22 Nov = 00:30 on 23 Nov in Israel (UTC+2 in winter)
    expect(todayInIsrael(new Date("2026-11-22T22:30:00Z"))).toBe("2026-11-23");
    expect(todayInIsrael(new Date("2026-11-22T10:00:00Z"))).toBe("2026-11-22");
  });

  it("accepts only real calendar dates in YYYY-MM-DD form", () => {
    expect(isValidDateOnly("2026-11-22")).toBe(true);
    expect(isValidDateOnly("2028-02-29")).toBe(true);
    expect(isValidDateOnly("2026-02-30")).toBe(false);
    expect(isValidDateOnly("22/11/2026")).toBe(false);
    expect(isValidDateOnly("2026-11-22T10:00:00Z")).toBe(false);
  });

  it("round-trips a DATE column value", () => {
    expect(formatDateOnly(parseDateOnly("2026-11-22"))).toBe("2026-11-22");
    expect(formatDateOnly(null)).toBeNull();
  });
});
