import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // ב-GitHub Pages האתר יושב תחת /CropGuard/ (ראו .github/workflows/pages.yml); מקומית - בשורש
  base: process.env.CROPGUARD_BASE ?? "/",
  server: {
    // 5173 הוא הפורט ששרת הליבה מאשר ב-CORS (CORS_ORIGINS)
    port: 5173,
    strictPort: true,
  },
});
