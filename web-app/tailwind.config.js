/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // WCAG 2.2 AA friendly palette: ink shades ≥ 4.5:1 on white,
        // brand-600+ ≥ 4.5:1 for text, brand-700 for text on brand-50.
        brand: {
          50: '#eef4ff',
          100: '#dbe6fe',
          200: '#bfd3fe',
          300: '#93b4fd',
          400: '#6090fa',
          500: '#3b6df6',
          600: '#254feb',
          700: '#1d3fd8',
          800: '#1e35af',
          900: '#1e308a'
        },
        ink: {
          900: '#101828',
          700: '#344054',
          600: '#475467',
          500: '#667085'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif']
      }
    }
  },
  plugins: []
}
