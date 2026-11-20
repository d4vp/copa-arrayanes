import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@shared": path.resolve(__dirname, "supabase/functions/_shared"), "@": path.resolve(__dirname, "src") } },
  test: { include: ["src/**/*.test.ts", "supabase/tests/**/*.test.ts", "supabase/functions/_shared/**/*.test.ts"], testTimeout: 30000 },
});
