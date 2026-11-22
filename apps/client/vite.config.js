import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 5173 הוא הפורט ששרת הליבה מאשר ב-CORS (CORS_ORIGINS)
    port: 5173,
    strictPort: true,
  },
});
