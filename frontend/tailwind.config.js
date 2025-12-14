/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable dark mode by class
  theme: {
    extend: {
      colors: {
        'gold': {
          DEFAULT: '#FFD86B',
          hover: '#E5BC43',
          dim: 'rgba(255, 216, 107, 0.1)',
        },
        'premium-gold': '#FFD86B',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // Ensure Inter is used if available, or add to index.html
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-slow': 'pulse 3s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}

