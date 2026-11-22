/**
 * הרחבת הטיפוס Request של Express: אחרי requireAuth, ב-request.user נמצא המשתמש המחובר.
 */

import type { Role } from "../generated/prisma/client.js";

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
