import type { Config } from "tailwindcss";

const config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    "bg-brand-purple",
    "bg-brand-purple-deep",
    "bg-brand-purple-light",
    "bg-brand-purple-muted",
    "bg-brand-green",
    "bg-brand-green-light",
    "bg-brand-green-muted",
    "text-brand-purple",
    "text-brand-purple-deep",
    "text-brand-green",
    "text-brand-green-light",
    "border-brand-purple",
    "border-brand-green",
    "bg-chillz-white",
    "bg-chillz-off",
    "bg-chillz-card",
    "bg-chillz-border",
    "text-chillz-text",
    "text-chillz-muted",
    "text-chillz-subtle",
    "shadow-card",
    "shadow-card-hover",
    "shadow-green",
    "shadow-purple",
    "rounded-2xl",
    "rounded-3xl",
    "rounded-4xl",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: "#5B0EA6",
          "purple-deep": "#3D0066",
          "purple-light": "#7B2FBE",
          "purple-muted": "#EDE0F7",
          green: "#00C853",
          "green-light": "#69F0AE",
          "green-muted": "#E0F7EA",
        },
        chillz: {
          white: "#FFFFFF",
          off: "#F7F5FA",
          card: "#F2EEF9",
          border: "#E4DCF0",
          text: "#0A0A0A",
          muted: "#6B6B6B",
          subtle: "#9E9E9E",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      boxShadow: {
        card: "0 2px 16px 0 rgba(91,14,166,0.07)",
        "card-hover": "0 8px 32px 0 rgba(91,14,166,0.15)",
        green: "0 4px 24px 0 rgba(0,200,83,0.25)",
        purple: "0 4px 24px 0 rgba(91,14,166,0.3)",
      },
      animation: {
        "fade-up": "fadeUp 0.5s ease forwards",
        "fade-in": "fadeIn 0.4s ease forwards",
        shimmer: "shimmer 1.5s infinite",
        pulse: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
        "spin-slow": "spin 3s linear infinite",
        float: "float 3s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
    },
  },
  plugins: [],
};
export default config as Config;