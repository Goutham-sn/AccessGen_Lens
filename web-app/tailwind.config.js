/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Links and focus. AA on white from 600 up.
        brand: {
          50: '#eef3ff', 100: '#dce6ff', 200: '#b9ccff', 300: '#8aa8f5', 400: '#5b82e8',
          500: '#3864d6', 600: '#2a52c2', 700: '#2043a6', 800: '#1b3785', 900: '#172e6b'
        },
        // The one signal colour: struggles, issues, "gave up".
        ember: {
          50: '#fdf1ee', 100: '#fadcd4', 200: '#f4bfb1', 300: '#ef9a85', 400: '#e9735a',
          500: '#e2502f', 600: '#c94124', 700: '#a8351d', 800: '#842a17'
        },
        ink: { 950: '#0e0e0e', 900: '#161616', 800: '#262626', 700: '#3b3b3b', 600: '#555555', 500: '#6b6b6b', 400: '#8f8f8f' },
        rule: '#e6e6e6',
        // The page itself is white; mist is for the few quiet panels.
        paper: '#ffffff',
        mist: '#f5f5f5'
      },
      borderRadius: { lg: '5px', xl: '6px', '2xl': '8px', '3xl': '10px' },
      boxShadow: {
        soft: '0 1px 0 rgba(0,0,0,.03)',
        lift: '0 1px 3px rgba(0,0,0,.08)'
      },
      keyframes: {
        'fade-up': { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        'pulse-ring': { '0%': { transform: 'scale(.6)', opacity: 0.9 }, '100%': { transform: 'scale(2.2)', opacity: 0 } }
      },
      animation: {
        'fade-up': 'fade-up .25s ease-out both',
        'pulse-ring': 'pulse-ring 2.2s cubic-bezier(.2,.6,.3,1) infinite'
      },
      fontFamily: {
        // Atkinson Hyperlegible, made by the Braille Institute for readers
        // with low vision: letters that cannot be mistaken for each other.
        sans: ['"Atkinson Hyperlegible Next"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Atkinson Hyperlegible Next"', 'system-ui', 'sans-serif'],
        mono: ['"Atkinson Hyperlegible Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      }
    }
  },
  plugins: []
}
