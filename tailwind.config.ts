import type { Config } from "tailwindcss";

/*
 * Tailwind v4: la fuente de verdad es el bloque `@theme` en app/globals.css.
 * Esta config es deliberadamente mínima (content + fontFamily fallback)
 * y existe solo para compatibilidad con tooling que aún la lee.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx,mdx}",
    "./components/**/*.{ts,tsx,mdx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-space-grotesk)", "Space Grotesk", "sans-serif"],
        body: ["var(--font-inter)", "Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
