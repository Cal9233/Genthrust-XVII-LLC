/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'navy': {
          DEFAULT: '#1e3a5f',
          light: '#2d4a6f',
          dark: '#0f2942',
        },
        'dark-charcoal': {
          DEFAULT: '#1a1f2e',
          50: '#3d4554',
          100: '#2d3442',
          200: '#252b38',
          300: '#1a1f2e',
          400: '#151923',
          500: '#0f1218',
        },
        'midnight-blue': {
          DEFAULT: '#0f172a',
          50: '#1e293b',
          100: '#172033',
          200: '#0f172a',
          300: '#0a0f1c',
          400: '#050811',
        },
        'electric-blue': {
          DEFAULT: '#0055B8',
          50: '#e6f2ff',
          100: '#cce5ff',
          200: '#99cbff',
          300: '#66b0ff',
          400: '#3396ff',
          500: '#007bff',
          600: '#0066cc',
          700: '#0055B8',
          800: '#004494',
          900: '#003370',
          950: '#00224d',
        },
        'crimson': {
          DEFAULT: '#b91c1c',
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
        'card-hover': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        'card-dark': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.2)',
        'card-dark-hover': '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
        'blue-accent': '0 0 0 3px rgba(0, 85, 184, 0.1)',
        'glow-blue': '0 0 20px rgba(0, 85, 184, 0.4), 0 0 40px rgba(0, 85, 184, 0.2)',
        'glow-blue-lg': '0 0 30px rgba(0, 85, 184, 0.6), 0 0 60px rgba(0, 85, 184, 0.4)',
        'glow-blue-input': '0 0 0 2px rgba(0, 85, 184, 0.5), 0 0 20px rgba(0, 85, 184, 0.4), 0 0 40px rgba(0, 85, 184, 0.2)',
        'glow-crimson': '0 0 20px rgba(185, 28, 28, 0.4), 0 0 40px rgba(185, 28, 28, 0.2)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': {
            boxShadow: '0 0 20px rgba(0, 85, 184, 0.4), 0 0 40px rgba(0, 85, 184, 0.2)'
          },
          '50%': {
            boxShadow: '0 0 30px rgba(0, 85, 184, 0.6), 0 0 60px rgba(0, 85, 184, 0.4)'
          },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glow-blue': 'radial-gradient(ellipse at center, rgba(0, 85, 184, 0.15) 0%, transparent 70%)',
        'glow-blue-strong': 'radial-gradient(ellipse at center, rgba(0, 85, 184, 0.25) 0%, transparent 70%)',
        'gradient-hero-dark': 'linear-gradient(180deg, #0f172a 0%, #1a1f2e 50%, #1a1f2e 100%)',
        'gradient-midnight': 'linear-gradient(135deg, #0f172a 0%, #1a1f2e 100%)',
        'gradient-electric': 'linear-gradient(135deg, rgba(0, 85, 184, 0.2) 0%, rgba(0, 85, 184, 0.05) 100%)',
        'gradient-electric-vertical': 'linear-gradient(180deg, rgba(0, 85, 184, 0.15) 0%, transparent 100%)',
        'gradient-overlay-dark': 'linear-gradient(to bottom, rgba(15, 23, 42, 0.8) 0%, rgba(26, 31, 46, 0.9) 100%)',
      },
    },
  },
  plugins: [],
}
