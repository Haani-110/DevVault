/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: 'var(--color-ink)',
          soft: 'var(--color-ink-soft)',
        },
        surface: {
          DEFAULT: 'var(--color-surface)',
          raised: 'var(--color-surface-raised)',
          hover: 'var(--color-surface-hover)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          soft: 'var(--color-border-soft)',
        },
        brass: {
          50: '#FBF3E4',
          100: '#F5E2BC',
          300: '#EDC57F',
          400: '#E8A33D',
          500: '#D9922B',
          600: '#B77620',
        },
        mint: {
          400: '#5EEAD4',
          500: '#2DD4BF',
          600: '#14B8A6',
        },
        // Fixed (theme-independent) dark tone for text placed on accent-colored
        // surfaces like buttons, where contrast must hold in both themes.
        onaccent: '#14181f',
        ok: '#4ADE80',
        warn: '#E8A33D',
        danger: '#F87171',
        text: {
          DEFAULT: 'var(--color-text)',
          muted: 'var(--color-text-muted)',
          faint: 'var(--color-text-faint)',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '10px',
        lg: '14px',
        xl: '20px',
      },
      boxShadow: {
        vault: '0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 24px -8px rgba(0,0,0,0.5)',
        glow: '0 0 0 1px rgba(232,163,61,0.25), 0 0 24px -4px rgba(232,163,61,0.35)',
      },
      keyframes: {
        'dial-tick': {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '50%': { transform: 'rotate(8deg)' },
        },
        'fade-up': {
          '0%': { opacity: 0, transform: 'translateY(6px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
      animation: {
        'dial-tick': 'dial-tick 2.4s ease-in-out infinite',
        'fade-up': 'fade-up 0.35s ease-out both',
      },
    },
  },
  plugins: [],
};
