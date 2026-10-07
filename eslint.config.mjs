import stylistic from "@stylistic/eslint-plugin";
import typescript from "@typescript-eslint/eslint-plugin";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    // Build output, not source.
    ignores: [
      "**/dist/**",
      "**/dev-dist/**",
      // Owns its own eslint.config.mjs and lint script, and pins its own
      // typescript-eslint against typescript 7 - which @typescript-eslint 8.x
      // cannot load (it reads ts.Extension, removed in 7). Lint it from inside
      // that package, not from here.
      "core/config-editor/tauri/**",
    ],
  },
  {
    plugins: {
      "@stylistic": stylistic,
      "@typescript-eslint": typescript
    },
    rules: {
      "@stylistic/quotes": ["warn", "double"],
      "@stylistic/semi": ["warn", "always"],
      "@stylistic/comma-dangle": ["warn", "only-multiline"],
      "@stylistic/indent": ["warn", 2],
      "@typescript-eslint/no-unused-vars": ["warn"],
      "@stylistic/indent": ["off"]
    },
  },
  {
    files: ["core/types/**/*.{ts,tsx}"],
    languageOptions: { globals: {}, parser: tsParser },
  },
  {
    files: ["core/shared/**/*.{ts,tsx}"],
    languageOptions: { globals: {}, parser: tsParser },
  },
  {
    files: ["core/match-agent/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.node, parser: tsParser },
  },
  {
    files: ["core/relay-server/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.serviceworker, parser: tsParser },
  },
  {
    files: ["core/node-services/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.node, parser: tsParser },
  },
  {
    files: ["core/config-editor-cli/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.node, parser: tsParser },
  },
  {
    files: ["core/config-editor/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser, parser: tsParser },
  },
  {
    // match-agent ships its own browser client (a React app), so it needs
    // browser globals rather than the node ones the core/match-agent/** block
    // above sets - this must stay after that block to win the override. It
    // also needs the react-hooks rules that its source already writes
    // per-line disable directives against; without the plugin registered,
    // each of those directives is itself an error.
    files: ["core/match-agent/client/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: { globals: globals.browser, parser: tsParser },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
