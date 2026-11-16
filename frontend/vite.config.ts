import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const alvoDaApi = process.env.API_ALVO ?? "http://127.0.0.1:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: alvoDaApi,
        changeOrigin: false,
        xfwd: true,
        rewrite: (caminho) => caminho.replace(/^\/api/, ""),
      },
    },
  },
  build: {
    target: "es2023",
    sourcemap: false,
  },
});
