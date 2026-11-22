/**
 * יצירת חיבור למסד הנתונים (Prisma Client).
 *
 * מ-Prisma 7 הקליינט מתחבר דרך "מתאם" (adapter) - כאן המתאם של PostgreSQL.
 * גם השרת וגם סקריפט ה-seed משתמשים בפונקציה הזו.
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma/client.js";

export function createPrismaClient(databaseUrl: string | undefined = process.env["DATABASE_URL"]): PrismaClient {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Copy apps/server/.env.example to apps/server/.env and fill it in.");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}
