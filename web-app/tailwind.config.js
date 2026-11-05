/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // AA on white: brand-600 and up, ink-500 and up, ember-700 and up.
        brand: {
          50: '#f3f2ff',
          100: '#e8e5ff',
          200: '#d1ccff',
          300: '#b0a7ff',
          400: '#8c7fff',
          500: '#6f5cf6',
          600: '#5c46e9',
          700: '#4b36cc',
          800: '#3d2ca3',
          900: '#2f2480'
        },
        // The colour of struggle: moments, hotspots, "gave up".
        ember: {
          50: '#fff3ef',
          100: '#ffe2d8',
          300: '#ffad93',
          400: '#ff8a66',
          500: '#ff6a45',
          600: '#e8502c',
          700: '#bf3d1d',
          800: '#963015'
        },
        ink: {
          950: '#0a0b11',
          900: '#13141c',
          800: '#1d1f2a',
          700: '#363948',
          600: '#4a4e60',
          500: '#636879'
        },
        paper: '#f7f6f2'
      },
      boxShadow: {
        soft: '0 1px 2px rgba(16,17,26,.04), 0 8px 24px -12px rgba(16,17,26,.12)',
        lift: '0 2px 4px rgba(16,17,26,.05), 0 24px 48px -20px rgba(16,17,26,.28)'
      },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'none' } },
        'pulse-ring': { '0%': { transform: 'scale(.6)', opacity: .9 }, '100%': { transform: 'scale(2.4)', opacity: 0 } }
      },
      animation: {
        'fade-up': 'fade-up .5s ease-out both',
        'pulse-ring': 'pulse-ring 2.2s cubic-bezier(.2,.6,.3,1) infinite'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'Times New Roman', 'serif']
      }
    }
  },
  plugins: []
}
