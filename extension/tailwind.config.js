/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Quorum brand blue - based on logo color #1A8FE3
        quorum: {
          50: '#EBF5FF',
          100: '#D6EBFF',
          200: '#ADD6FF',
          300: '#70B8F8',
          400: '#3D9EF2',
          500: '#1A8FE3',  // Primary brand color
          600: '#1477C2',
          700: '#0F5F9E',
          800: '#0A4778',
          900: '#063052',
        },
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
      },
      boxShadow: {
        'bubbly': '0 4px 14px 0 rgba(0, 118, 255, 0.15)',
        'bubbly-lg': '0 8px 24px 0 rgba(0, 118, 255, 0.2)',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      },
    },
  },
  plugins: [],
};
