/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Manrope', 'sans-serif'],
      },
      colors: {
        teal: {
          50:  '#edfafa',
          100: '#d5f5f6',
          200: '#afeaef',
          300: '#7dd9e5',
          400: '#42c3d2',
          500: '#25a5b8',
          600: '#1d8799',
          700: '#1b6e7d',
          800: '#1c5966',
          900: '#1a4a54',
        },
        brand: {
          DEFAULT: '#087B75',
          dark:    '#065e59',
          light:   '#0a9a92',
          muted:   '#e8f4f3',
        },
        risk: {
          high:    '#dc2626',
          'high-bg': '#fef2f2',
          medium:  '#d97706',
          'medium-bg': '#fffbeb',
          low:     '#16a34a',
          'low-bg':'#f0fdf4',
        },
      },
    },
  },
  plugins: [],
}
