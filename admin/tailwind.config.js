/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'green-rich': '#1a4d1a',
        'green-accent': '#2d7a2d',
        'green-bright': '#3daa3d',
        gold: '#c9a84c',
        'gold-light': '#e8cc80',
      },
      fontFamily: {
        garamond: ['"Cormorant Garamond"', 'serif'],
        sans: ['"DM Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
