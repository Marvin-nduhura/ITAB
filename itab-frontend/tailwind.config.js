/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        gold: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in':    'fadeIn 0.3s ease-in-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in':   'scaleIn 0.2s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'bounce-in':  'bounceIn 0.5s ease-out',
      },
      keyframes: {
        fadeIn:   { '0%': { opacity: '0' },                                    '100%': { opacity: '1' } },
        slideUp:  { '0%': { transform: 'translateY(20px)', opacity: '0' },     '100%': { transform: 'translateY(0)',    opacity: '1' } },
        slideDown:{ '0%': { transform: 'translateY(-20px)', opacity: '0' },    '100%': { transform: 'translateY(0)',    opacity: '1' } },
        scaleIn:  { '0%': { transform: 'scale(0.9)', opacity: '0' },           '100%': { transform: 'scale(1)',         opacity: '1' } },
        bounceIn: { '0%': { transform: 'scale(0.3)', opacity: '0' }, '50%': { transform: 'scale(1.05)' }, '70%': { transform: 'scale(0.9)' }, '100%': { transform: 'scale(1)', opacity: '1' } },
      },
      boxShadow: {
        'card':    '0 2px 15px -3px rgba(0,0,0,0.07), 0 10px 20px -2px rgba(0,0,0,0.04)',
        'card-lg': '0 10px 40px -10px rgba(0,0,0,0.15)',
        'glow':    '0 0 20px rgba(59,130,246,0.3)',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}
