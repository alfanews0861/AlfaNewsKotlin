
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./*.{js,ts,jsx,tsx}"
  ],
  important: true,
  theme: {
    extend: {
      fontFamily: {
        mallanna: ['Mallanna', 'sans-serif'],
        ramabhadra: ['Ramabhadra', 'sans-serif'],
        poppins: ['Poppins', 'sans-serif'],
        lato: ['Lato', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
        signature: ['Great Vibes', 'cursive'],
      },
      fontWeight: {
        regular: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
      }
    },
  },
  plugins: [],
}
