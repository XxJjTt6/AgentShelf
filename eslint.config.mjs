import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  {
    ignores: ["tmp/**", "output/**", "submission/**"],
  },
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([".next/**", "coverage/**"]),
]);
