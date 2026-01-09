/******************************************************************************
 * Tailwind config for login landing
 ******************************************************************************/
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eef5ff",
          100: "#d9e8ff",
          200: "#b3d1ff",
          300: "#8cb8ff",
          400: "#669fff",
          500: "#3f86ff",
          600: "#1f6de6",
          700: "#1456b4",
          800: "#0c3d82",
          900: "#072750"
        }
      },
      boxShadow: {
        card: "0 20px 60px -25px rgba(0,0,0,0.35)"
      }
    }
  },
  plugins: [require('@tailwindcss/forms')]
};
