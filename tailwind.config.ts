import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["IBM Plex Mono", "monospace"],
        body: ["IBM Plex Sans", "sans-serif"],
      },
      colors: {
        "surface-elevated": "hsl(var(--surface-elevated))",
        "text-dim": "hsl(var(--text-dim))",
        "text-subtle": "hsl(var(--text-subtle))",
        "accent-teal": "hsl(var(--accent-teal))",
        "accent-teal-dim": "hsl(var(--accent-teal-dim))",
        "memory-manual": "hsl(var(--memory-manual))",
        "memory-governed": "hsl(var(--memory-governed))",
        "memory-pending": "hsl(var(--memory-pending))",
        "memory-historical": "hsl(var(--memory-historical))",
        "system-marker": "hsl(var(--system-marker))",
      },
    },
  },
};

export default config;
