/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Legacy tokens — still used by the public Landing page
        'green-rich': '#1a4d1a',
        'green-accent': '#2d7a2d',
        'green-bright': '#3daa3d',
        gold: '#c9a84c',
        'gold-light': '#e8cc80',
        // AeuxGlobal dashboard theme
        primary: {
          DEFAULT: '#1A6B1A',
          700: '#145714',
        },
        forest: {
          DEFAULT: '#0B3D2E',
          deep: '#082A20',
          700: '#0F4A38',
        },
        accent: {
          DEFAULT: '#2FA355',
          400: '#46C56B',
        },
        mint: {
          DEFAULT: '#EDF4EC',
          100: '#F4F8F2',
        },
        ink: '#0E1A14',
      },
      fontFamily: {
        garamond: ['"Cormorant Garamond"', 'serif'],
        sans: ['"DM Sans"', 'Inter', 'system-ui', 'sans-serif'],
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
