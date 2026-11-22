/**
 * הרחבת הטיפוס Request של Express: אחרי requireAuth, ב-request.user נמצא המשתמש המחובר.
 */

import type { Role } from "../generated/prisma/client.js";

/** המשתמש המחובר כפי שהוא זמין ב-request.user (בלי סיסמה ובלי שדות פנימיים) */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
