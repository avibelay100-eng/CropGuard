/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** כתובת ה-API של שרת הליבה, למשל http://localhost:3000/api */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
