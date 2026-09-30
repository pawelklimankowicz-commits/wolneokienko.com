import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { apiWolnegoOkienka } from "./src/serwer/vite-api";

export default defineConfig({
  plugins: [react(), apiWolnegoOkienka()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
