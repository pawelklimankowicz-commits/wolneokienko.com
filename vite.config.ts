import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { apiWolnegoOkienka } from "./src/serwer/vite-api";

export default defineConfig(({ mode }) => ({
  plugins: [react(), apiWolnegoOkienka()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  // podgląd bez serwera idzie jako jeden plik HTML — bez osobnych kawałków JS, czcionki i obrazy w środku
  build: mode === "podglad" ? { assetsInlineLimit: 100_000_000, rollupOptions: { output: { inlineDynamicImports: true } } } : {},
}));
