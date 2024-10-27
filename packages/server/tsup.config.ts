import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"], // Build for commonJS and ESmodules
  splitting: false,
  dts: true,
  sourcemap: true,
  clean: true,
});
