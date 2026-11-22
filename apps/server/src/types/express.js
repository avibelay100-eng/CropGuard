/**
 * הרחבת הטיפוס Request של Express: אחרי requireAuth, ב-request.user נמצא המשתמש המחובר.
 */

/**
 * המשתמש המחובר כפי שהוא זמין ב-request.user (בלי סיסמה ובלי שדות פנימיים)
 * @typedef {object} AuthUser
 * @property {string} id
 * @property {string} email
 * @property {string} name
 * @property {Role} role
 */

    /**
     * @typedef {object} Request
     * @property {AuthUser} [user]
     */

export {};
