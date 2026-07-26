/// <reference types="vite/client" />

declare module '*.md' {
  const content: string;
  export default content;
}

declare module '*.css' {}

declare module '*.svg' {
  const content: string;
  export default content;
}
