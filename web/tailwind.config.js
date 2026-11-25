/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"], display: ["Sora", "Inter", "sans-serif"] },
      colors: {
        fg: v("fg"), muted: v("muted"), subtle: v("subtle"), accent: v("accent"), surface: v("surface"),
        good: v("good"), bad: v("bad"), caution: v("caution"),
        ink: { 950: "#060b16", 900: "#0a1224", 800: "#111b33", 700: "#1a2745", 600: "#2a3a60" },
        gold: { 300: "#ffd980", 400: "#f7c548", 500: "#e8a317" },
        safe: "#22c55e", danger: "#ef4444", warn: "#f59e0b",
      },
    },
  },
  plugins: [],
};
