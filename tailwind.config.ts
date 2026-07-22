import type { Config } from "tailwindcss";

// Tailwind theme for a Trello + Microsoft Teams Calendar inspired UI.
// Category colors drive card accents, the app chrome uses a Teams-like
// deep purple header and a light slate canvas.
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Teams-like app chrome (header / sidebar brand).
        brand: {
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
        },
        // Category accent palette (left border + tinted background per card).
        cat: {
          HISTORICAL: { bg: "#fef3c7", border: "#d97706", text: "#92400e" },
          UNIQUE: { bg: "#ede9fe", border: "#7c3aed", text: "#5b21b6" },
          INSTAGRAMMABLE: { bg: "#fce7f3", border: "#db2777", text: "#9d174d" },
          TOURIST_ATTRACTION: { bg: "#dbeafe", border: "#2563eb", text: "#1e40af" },
          RESTAURANT: { bg: "#fee2e2", border: "#dc2626", text: "#991b1b" },
          STREET_FOOD: { bg: "#ffedd5", border: "#ea580c", text: "#9a3412" },
          NATURE: { bg: "#dcfce7", border: "#16a34a", text: "#166534" },
          MUSEUM: { bg: "#ccfbf1", border: "#0d9488", text: "#115e59" },
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)",
        cardHover: "0 4px 12px rgba(0,0,0,0.12)",
      },
      spacing: {
        slot: "40px",
      },
    },
  },
  plugins: [],
};

export default config;
