import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

// Flat ESLint config. The rule that earns its keep here is `no-undef`: in a
// large file being decomposed into modules, the #1 risk is moving a symbol out
// and forgetting to import it back. That's a runtime crash the bundler won't
// catch — but `no-undef` flags it instantly. (See the historical `showPrep`
// bug: a one-line lint pass would have caught it.)

export default [
  { ignores: ["dist/**", "node_modules/**", "functions/**"] },
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, "react-hooks": reactHooks },
    rules: {
      ...js.configs.recommended.rules,
      "no-undef": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // Treat JSX-referenced identifiers as used so imported components don't
      // trip no-unused-vars.
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "off",
      "react-hooks/rules-of-hooks": "error",
      // Advisory only — this codebase intentionally uses partial deps in places.
      "react-hooks/exhaustive-deps": "off",
    },
  },
];
