import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // מכין את מסד הבדיקות (מיגרציות + נתוני בסיס) פעם אחת לפני כל הבדיקות
    globalSetup: ["test/globalSetup.ts"],
    // כל קובצי הבדיקה חולקים מסד אחד, לכן הם רצים אחד אחרי השני
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
