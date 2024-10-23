import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/bin.ts"],
  format: ["cjs", "esm"], // Build for commonJS and ESmodules
  splitting: false,
  sourcemap: true,
  clean: true,
});
