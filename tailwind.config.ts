import type { Config } from "tailwindcss";

/**
 * PRUNE - green-gold temporal sci-fi palette.
 * Deep desaturated green base, luminous gold accents (brightest gold is
 * reserved for active/prune moments), near-black charcoal ground.
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
        ash: "#c9c3b0",
        /**
         * TVA / Asgardian HUD palette - the exact tokens the sidebar, drawer
         * and banners are built from. Separate from moss/gold above, which
         * stay reserved for the 3D scene's own materials.
         */
        abyss: {
          DEFAULT: "#080F0E",
          deep: "#04271A",
          panel: "#0B3D2E",
        },
        weave: {
          DEFAULT: "#10B981",
          bright: "#00FFCC",
        },
        warn: {
          DEFAULT: "#FF9900",
          deep: "#E65100",
        },
        brass: "#D4AF37",
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
