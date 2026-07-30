// The consuming host is expected to bundle this package with Vite (or
// provide an equivalent import.meta.env) - the package itself doesn't
// depend on vite, so declare the shape here instead of vite/client.
interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly [key: string]: any;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.md' {
  const content: string;
  export default content;
}

declare module '*.css' {}

declare module '*.svg' {
  const content: string;
  export default content;
}
