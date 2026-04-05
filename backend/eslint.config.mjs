import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import * as eslintPluginImportX from "eslint-plugin-import-x";
import eslintPluginPrettier from "eslint-plugin-prettier";

export default tseslint.config(
  // ── Base rules ──
  eslint.configs.recommended,

  // ── TypeScript strict + stylistic ──
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // ── TypeScript parser options ──
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // ── Plugin: Import order & hygiene ──
  {
    plugins: { "import-x": eslintPluginImportX },
    rules: {
      "import-x/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            ["parent", "sibling"],
            "index",
            "type",
          ],
          "newlines-between": "never",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "import-x/no-duplicates": "error",
      "import-x/no-mutable-exports": "error",
      "import-x/first": "error",
    },
  },

  // ── Plugin: Prettier as ESLint rule ──
  {
    plugins: { prettier: eslintPluginPrettier },
    rules: {
      "prettier/prettier": "warn",
    },
  },

  // ── Custom rules ──
  {
    rules: {
      // Allow leading underscores for unused vars (common Express pattern: _req, _next)
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // Relax for Express error handlers & middleware chains
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { arguments: false } },
      ],

      // Allow explicit any in type assertions where needed
      "@typescript-eslint/no-explicit-any": "warn",

      // Allow non-null assertions (common with validated Express req.user!, req.params)
      "@typescript-eslint/no-non-null-assertion": "off",

      // Enforce consistent type imports
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],

      // Return types — off for internal services/helpers, inferred by TS
      "@typescript-eslint/explicit-function-return-type": "off",

      // No floating promises (must be awaited or void-returned)
      "@typescript-eslint/no-floating-promises": "error",

      // Prefer nullish coalescing
      "@typescript-eslint/prefer-nullish-coalescing": "warn",

      // Allow numbers and booleans in template literals
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true, allowBoolean: true },
      ],

      // Void expressions in arrow shorthand — allow in statements
      "@typescript-eslint/no-confusing-void-expression": [
        "error",
        { ignoreArrowShorthand: true },
      ],

      // Allow empty interfaces for declaration merging (e.g. Express.Request)
      "@typescript-eslint/no-empty-object-type": [
        "error",
        { allowInterfaces: "with-single-extends" },
      ],

      // Allow console.log in instrument/logger code
      "no-console": ["warn", { allow: ["warn", "error", "info", "debug"] }],

      // Relax strict-type-checked rules that produce noise in Express apps
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/no-unnecessary-type-conversion": "off",
      "@typescript-eslint/no-deprecated": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/restrict-plus-operands": "off",

      // General
      eqeqeq: ["error", "always"],
      "no-return-await": "off",
      "@typescript-eslint/return-await": ["error", "in-try-catch"],
    },
  },

  // ── Prettier compat (must be last) ──
  eslintConfigPrettier,

  // ── Ignores ──
  {
    ignores: [
      "dist/",
      "node_modules/",
      "coverage/",
      "prisma/",
      "*.config.*",
      ".prettierrc.*",
      "commitlint.config.js",
      "src/__tests__/",
    ],
  },
);
