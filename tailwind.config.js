/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#fbbf24', dark: '#d99e06', light: '#fdd66b' },
        ink: 'var(--ink)',
        ink2: 'var(--ink2)',
        ink3: 'var(--ink3)',
        surface: 'var(--surface)',
        surface2: 'var(--surface2)',
        surface3: 'var(--surface3)',
        line: 'var(--line)',
        good: '#34d399',
        warn: '#f59e0b',
        bad: '#f87171',
      },
      borderRadius: { xl2: '1.25rem' },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.18)',
        sheet: '0 -8px 40px rgba(0,0,0,0.45)',
      },
    },
  },
  plugins: [],
}
