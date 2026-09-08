/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1A6B1A',
          700: '#145714',
        },
        // Deep forest — sidebar, desktop app frame, dark feature cards
        forest: {
          DEFAULT: '#0B3D2E',
          deep: '#082A20',
          700: '#0F4A38',
        },
        // Bright grass-green accent — gauges, deltas, highlights
        accent: {
          DEFAULT: '#2FA355',
          400: '#46C56B',
        },
        // Pale mint — page background
        mint: {
          DEFAULT: '#EDF4EC',
          100: '#F4F8F2',
        },
        ink: '#0E1A14',
        lime: '#4CFF4C',
        gold: '#FFD700',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '1.75rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.04), 0 16px 32px -16px rgba(11,61,46,0.14)',
        'card-dark': '0 20px 44px -20px rgba(0,0,0,0.55)',
        frame: '0 40px 80px -32px rgba(8,42,32,0.45)',
      },
    },
  },
  plugins: [],
};
