import { createReadStream, readFileSync } from "node:fs";
import path from "path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { apiWolnegoOkienka } from "./src/serwer/vite-api";

// Odczyt zdjęć cenników (src/lib/ocr.ts) z naszego serwera, nie z CDN: adres IP
// salonu nie trafia do firmy trzeciej, a odczyt nie zależy od cudzej usługi.
// Pliki biorą się z node_modules — do builda (katalog ocr/) i pod `npm run dev`.
const PLIKI_OCR: Record<string, string> = {
  "ocr/worker.min.js": "node_modules/tesseract.js/dist/worker.min.js",
  "ocr/tesseract-core-lstm.wasm.js": "node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js",
  "ocr/tesseract-core-simd-lstm.wasm.js": "node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js",
  "ocr/tesseract-core-relaxedsimd-lstm.wasm.js": "node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js",
  "ocr/pol.traineddata.gz": "node_modules/@tesseract.js-data/pol/4.0.0_best_int/pol.traineddata.gz",
};

/** Podgląd (artefakt) nie serwuje plików .gz — tam słownik leży pod nazwą .wasm (src/lib/ocr.ts). */
const SLOWNIK_PODGLADU = "ocr/pol-slownik.wasm";

function ocrLokalnie(podglad: boolean): Plugin {
  return {
    name: "ocr-lokalnie",
    configureServer: (serwer) =>
      void serwer.middlewares.use((req, res, dalej) => {
        const plik = PLIKI_OCR[(req.url ?? "").split("?")[0].replace(/^\//, "")];
        if (!plik) return dalej();
        res.setHeader("Content-Type", plik.endsWith(".gz") ? "application/gzip" : "text/javascript");
        createReadStream(path.resolve(__dirname, plik)).pipe(res);
      }),
    generateBundle() {
      for (const [nazwa, zrodlo] of Object.entries(PLIKI_OCR)) {
        const plik = podglad && nazwa.endsWith(".gz") ? SLOWNIK_PODGLADU : nazwa;
        this.emitFile({ type: "asset", fileName: plik, source: readFileSync(path.resolve(__dirname, zrodlo)) });
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), apiWolnegoOkienka(), ocrLokalnie(mode === "podglad")],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  // Podgląd bez serwera: jeden plik JS i jeden CSS (czcionki i obrazy w środku),
  // ze ścieżkami względnymi — publikowany jako strona z tymi dwoma plikami obok.
  base: mode === "podglad" ? "./" : "/",
  build: mode === "podglad" ? { assetsInlineLimit: 100_000_000, rollupOptions: { output: { inlineDynamicImports: true } } } : {},
}));
