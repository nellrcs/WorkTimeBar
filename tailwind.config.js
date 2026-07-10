/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./painel.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        neutral: {
          850: '#202022',
        }
      }
    },
  },
  plugins: [],
}
