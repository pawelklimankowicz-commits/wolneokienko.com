import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { apiWolnegoOkienka } from "./src/serwer/vite-api";

export default defineConfig(({ mode }) => ({
  plugins: [react(), apiWolnegoOkienka()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  // Podgląd bez serwera: jeden plik JS i jeden CSS (czcionki i obrazy w środku),
  // ze ścieżkami względnymi — publikowany jako strona z tymi dwoma plikami obok.
  base: mode === "podglad" ? "./" : "/",
  build: mode === "podglad" ? { assetsInlineLimit: 100_000_000, rollupOptions: { output: { inlineDynamicImports: true } } } : {},
}));
