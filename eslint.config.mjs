import stylistic from "@stylistic/eslint-plugin";
import typescript from "@typescript-eslint/eslint-plugin";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";

export default [
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
];
