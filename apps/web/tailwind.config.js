/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        zju: {
          primary: "#003f88",
          light: "#2b6cb0",
        },
      },
    },
  },
  plugins: [],
};
