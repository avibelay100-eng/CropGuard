import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // טעינת המודל לוקחת זמן, לכן מגדילים את זמן ההמתנה לבדיקה
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
