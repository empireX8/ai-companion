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
        sans: ["IBM Plex Sans", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
        display: ["IBM Plex Mono", "monospace"],
        body: ["IBM Plex Sans", "sans-serif"],
      },
      colors: {
        elevated: "hsl(var(--elevated))",
        meta: "hsl(var(--meta))",
        warm: "hsl(var(--warm))",
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
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        "pulse-cyan": {
          "0%,100%": { opacity: "0.6", boxShadow: "0 0 0 0 hsl(187 100% 50% / 0.4)" },
          "50%": { opacity: "1", boxShadow: "0 0 0 6px hsl(187 100% 50% / 0)" },
        },
        "fade-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-cyan": "pulse-cyan 2.4s ease-in-out infinite",
        "fade-in": "fade-in 0.4s ease-out",
      },
    },
  },
};

export default config;
