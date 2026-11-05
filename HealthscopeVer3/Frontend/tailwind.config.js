/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        midnight: {
          DEFAULT: "#101A35",
          50: "#F3F5FA",
          100: "#E2E7F3",
          400: "#22305A",
          600: "#18244A",
          700: "#131E3D",
          800: "#101A35",
          900: "#0B1226",
        },
        royal: {
          DEFAULT: "#4169E1",
          light: "#6C8CEA",
          dark: "#2F4FB8",
        },
        pale: "#EAF2FF",
        teal: {
          DEFAULT: "#14B8A6",
          dark: "#0F8F81",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 26, 53, 0.06), 0 8px 24px rgba(16, 26, 53, 0.06)",
        soft: "0 1px 3px rgba(16, 26, 53, 0.08)",
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.15rem",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
      },
    },
  },
  plugins: [],
};