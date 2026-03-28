import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',
        mist: '#f8fafc',
        peach: '#fb923c',
        mint: '#10b981',
        coral: '#ef4444',
        sky: '#38bdf8',
      },
      boxShadow: {
        soft: '0 18px 48px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
} satisfies Config
