/**
 * הפיכת משתמש קיים למנהל מערכת (ADMIN).
 *
 * ADMIN לא יכול להירשם בעצמו דרך ה-API, לכן יוצרים אותו כך:
 *   1. נרשמים רגיל (POST /api/auth/register)
 *   2. מריצים מתוך apps/server:
 *        npm run promote-admin -- user@example.com
 *
 * הסקריפט לא מטפל בסיסמאות בכלל - רק משנה את התפקיד.
 */

import { createPrismaClient } from "../src/db.js";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run promote-admin -- <email>");
  process.exit(1);
}

const prisma = createPrismaClient();
try {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user with email ${email}. Register first, then run this again.`);
    process.exitCode = 1;
  } else if (user.role === "ADMIN") {
    console.log(`${email} is already an ADMIN.`);
  } else {
    await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
    console.log(`${email}: ${user.role} -> ADMIN`);
  }
} finally {
  await prisma.$disconnect();
}
