/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Deep emerald primary - represents growth, faith, trust
        primary: {
          50: '#f0f7f4',
          100: '#dceee5',
          200: '#bcdccf',
          300: '#8ec3b2',
          400: '#5fa692',
          500: '#3f8a78',
          600: '#2e6f60',
          700: '#27594e',
          800: '#214740',
          900: '#0F4A3C',
          950: '#0a2e25',
        },
        // Warm amber/gold accent - dignity, generosity
        accent: {
          50: '#fbf8ef',
          100: '#f5edd3',
          200: '#ead9a4',
          300: '#dec077',
          400: '#d4a24e',
          500: '#c98a35',
          600: '#ad6b2a',
          700: '#8a4f25',
          800: '#714024',
          900: '#5e3621',
        },
        // Warm cream surface
        cream: {
          50: '#FAF7F2',
          100: '#F5F0E6',
          200: '#EBE2D0',
          300: '#DDD0B5',
          400: '#C9B791',
        },
        ink: {
          900: '#1A1F1D',
          800: '#2A302D',
          700: '#3D4541',
          600: '#5A6660',
          500: '#7E8A84',
          400: '#A5AFA9',
          300: '#CCD3CF',
          200: '#E4E8E5',
          100: '#F2F4F2',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'soft': '0 1px 3px rgba(15, 74, 60, 0.04), 0 4px 12px rgba(15, 74, 60, 0.06)',
        'lift': '0 4px 16px rgba(15, 74, 60, 0.08), 0 12px 32px rgba(15, 74, 60, 0.06)',
        'inner-soft': 'inset 0 1px 2px rgba(15, 74, 60, 0.05)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};
