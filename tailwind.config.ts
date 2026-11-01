import type { Config } from "tailwindcss";

/**
 * AM I A WATCHER - green-gold temporal sci-fi palette.
 *
 * The chrome colours resolve to CSS custom properties declared in
 * globals.css, so each has exactly one definition and the canvas, the
 * shaders and the utility classes cannot drift apart.
 *
 * Each is composed as `rgb(var(--x) / <alpha-value>)`, which is what lets
 * `bg-hud-black/40` work. A bare `var(--x)` holding a hex string compiles but
 * produces nothing for every opacity modifier in the project. The literal scales
 * below (moss, gold, void) are older and stay literal for now; they are
 * only used by the CRT texture layer.
 *
 * The palette, the uppercase labels and the mono data type all come from the
 * reference screenshots in /design-refs. They are the TVA's own vernacular
 * rather than defaults reached for - the brief pins this axis down.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: {
          DEFAULT: "#07090a",
          900: "#0a0d0e",
          800: "#111614",
        },
        moss: {
          900: "#0d1a14",
          800: "#12241b",
          700: "#183024",
          600: "#1f4030",
          500: "#2b5a42",
          400: "#3d7a58",
          300: "#5a9c74",
          200: "#8ec3a2",
        },
        gold: {
          900: "#3d2f0c",
          800: "#6b5314",
          700: "#9a781d",
          600: "#c69a24",
          500: "#e0b840",
          400: "#f0cf68",
          300: "#f8e3a0",
          200: "#fdf3d4",
        },
        ash: "rgb(var(--ash) / <alpha-value>)",
        abyss: {
          DEFAULT: "#050807",
          deep: "#06331F",
          panel: "#0E5138",
        },
        /**
         * Sampled from the reference screenshots. The chrome is a mid forest
         * green with gold rules; nav blocks are near-black; the two action
         * pills are a flat blue and brick red.
         */
        hud: {
          green: "rgb(var(--hud-green) / <alpha-value>)",
          greenDark: "rgb(var(--hud-green-dark) / <alpha-value>)",
          panel: "rgb(var(--hud-panel) / <alpha-value>)",
          black: "rgb(var(--hud-black) / <alpha-value>)",
        },
        brass: {
          DEFAULT: "rgb(var(--brass) / <alpha-value>)",
          dim: "rgb(var(--brass-dim) / <alpha-value>)",
        },
        weave: {
          DEFAULT: "#10B981",
          bright: "#00FFCC",
        },
        warn: {
          DEFAULT: "rgb(var(--warn) / <alpha-value>)",
          deep: "#E65100",
        },
        pill: {
          blue: "rgb(var(--pill-blue) / <alpha-value>)",
          blueDark: "#215C7D",
          red: "rgb(var(--pill-red) / <alpha-value>)",
          redDark: "#8A2C23",
        },
      },
      /*
       * The type scale. Named by role, not by size, so a component asks for
       * the job it is doing and the ramp can be retuned in one place.
       * Values follow the scale recorded in CLAUDE.md.
       */
      fontSize: {
        micro: ["0.625rem", { lineHeight: "1.1", letterSpacing: "0.06em" }],
        meta: ["0.75rem", { lineHeight: "1.25", letterSpacing: "0.04em" }],
        body: ["0.875rem", { lineHeight: "1.55" }],
        lead: ["1rem", { lineHeight: "1.5" }],
        title: ["1.25rem", { lineHeight: "1.15" }],
        display: ["1.75rem", { lineHeight: "1.05", letterSpacing: "-0.01em" }],
        hero: ["2.5rem", { lineHeight: "0.98", letterSpacing: "-0.015em" }],
        colossal: ["3.5rem", { lineHeight: "0.95", letterSpacing: "-0.02em" }],
        monolith: ["4.5rem", { lineHeight: "0.92", letterSpacing: "-0.025em" }],
      },
      spacing: {
        "safe-t": "var(--safe-top)",
        "safe-r": "var(--safe-right)",
        "safe-b": "var(--safe-bottom)",
        "safe-l": "var(--safe-left)",
      },
      fontFamily: {
        // Freely-licensed faces only. No official/copyrighted title fonts.
        display: ["var(--font-display)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px -4px rgba(224,184,64,0.45)",
        "glow-moss": "0 0 28px -6px rgba(90,156,116,0.5)",
      },
      keyframes: {
        flicker: {
          "0%,100%": { opacity: "1" },
          "45%": { opacity: "0.86" },
          "50%": { opacity: "1" },
          "55%": { opacity: "0.92" },
        },
        sweep: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        "pulse-gold": {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(224,184,64,0.5)" },
          "50%": { boxShadow: "0 0 0 10px rgba(224,184,64,0)" },
        },
        "stamp-in": {
          "0%": { transform: "scale(2.4) rotate(-9deg)", opacity: "0" },
          "60%": { transform: "scale(0.94) rotate(-3deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(-3deg)", opacity: "1" },
        },
      },
      animation: {
        flicker: "flicker 6s ease-in-out infinite",
        sweep: "sweep 7s linear infinite",
        "pulse-gold": "pulse-gold 2s ease-out infinite",
        "stamp-in": "stamp-in 500ms cubic-bezier(.2,1.4,.4,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
