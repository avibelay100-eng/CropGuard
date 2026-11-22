import { describe, expect, it } from "vitest";

import { formatCoordinates, formatPercent, formatPriceRange } from "./format";

describe("format", () => {
  it.each([
    [110, 180, "₪110–180"],
    [45, 45, "₪45"],
    [1200, 1850, "₪1,200–1,850"],
  ])("formats a shekel range %d-%d as %s", (min, max, expected) => {
    expect(formatPriceRange(min, max)).toBe(expected);
  });

  it.each([
    [89.95, "90%"],
    [42.5, "42.5%"],
    [97, "97%"],
    [0, "0%"],
  ])("formats %d as %s", (value, expected) => {
    expect(formatPercent(value)).toBe(expected);
  });

  it("shortens coordinates to 4 decimals", () => {
    expect(formatCoordinates(31.251834, 34.791312)).toBe("31.2518, 34.7913");
  });
});
