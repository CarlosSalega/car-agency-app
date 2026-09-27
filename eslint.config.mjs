import path from "path";
import { fileURLToPath } from "url";

import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);

const compat = new FlatCompat({
  baseDirectory: currentDirectory,
  recommendedConfig: js.configs.recommended,
});

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "public/**",
      "dist/**",
      "build/**",
      ".turbo/**",
      "coverage/**",
      "next-env.d.ts",
      "prisma/**",

      // Third-party agent skills vendored into the repo. These are bundled
      // builds (e.g. `impeccable/scripts/*.umd.js`) plus Node scripts, not
      // application code — they are not ours to lint, fix, or keep in sync.
      //
      // Before this ignore, they accounted for 94 of the 132 reported problems
      // (78 `no-unused-expressions` + 16 `no-unused-vars`), all from two files.
      // That noise was hiding the 38 real problems in `src/`, including a
      // `rules-of-hooks` violation with actual render risk.
      ".agents/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript", "prettier"),
];

export default eslintConfig;
