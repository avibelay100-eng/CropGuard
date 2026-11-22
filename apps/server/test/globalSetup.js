/**
 * הכנת מסד הבדיקות, פעם אחת לפני כל הבדיקות:
 * מחילה את המיגרציות וטוענת את נתוני הבסיס (מחירים והמלצות).
 *
 * בלי TEST_DATABASE_URL - בדיקות המסד מדולגות (בדיקות היחידה עדיין רצות).
 */

import "dotenv/config";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { seedReferenceData } from "../prisma/seed.js";
import { createPrismaClient } from "../src/db.js";

const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export default async function setup() {
  const url = process.env["TEST_DATABASE_URL"];
  if (!url) {
    console.warn("\n⚠ TEST_DATABASE_URL is not set - database integration tests will be SKIPPED.\n");
    return;
  }
  // הגנה: הבדיקות מוחקות נתונים, ולכן אסור שזה יהיה מסד הפיתוח
  if (url === process.env["DATABASE_URL"]) {
    throw new Error("TEST_DATABASE_URL must be different from DATABASE_URL - the tests delete data.");
  }

  execSync("npx prisma migrate deploy", {
    cwd: SERVER_DIR,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });

  const prisma = createPrismaClient(url);
  try {
    await seedReferenceData(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
