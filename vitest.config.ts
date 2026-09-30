import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts", "baza/**/*.test.ts", "scripts/**/*.test.ts"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
