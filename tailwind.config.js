/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary brand color - Navy Blue from logo
        'navy': {
          DEFAULT: '#1e4a8d',
          50: '#f0f4f9',
          100: '#dae3f0',
          200: '#b8cae3',
          300: '#8aa8d1',
          400: '#5a82ba',
          500: '#3d67a3',
          600: '#1e4a8d',  // Primary brand color
          700: '#1a3f78',
          800: '#163462',
          900: '#132b51',
        },
        // Secondary brand color - Burgundy from logo
        'burgundy': {
          50: '#fdf2f4',
          100: '#fce7ea',
          200: '#f9d0d7',
          300: '#f4a9b6',
          400: '#ec7a8f',
          500: '#df4d69',
          600: '#9c2a3e',  // Secondary brand color
          700: '#8a2436',
          800: '#73202f',
          900: '#631e2b',
        },
        // Status colors - solid for light backgrounds
        'status': {
          'available': '#059669',
          'limited': '#d97706',
          'aog': '#dc2626',
        },
        // Aviation-Tech Premium Colors
        'space': {
          DEFAULT: '#020617',  // Deep space blue/black
          50: '#0f172a',
          100: '#1e293b',
        },
        'aviation-red': '#EF4444',
        'horizon-blue': '#38B2AC',
        'silver': '#F8FAFC',
        // Accent colors - bright accents for CTAs and interactive elements
        'electric-blue': {
          DEFAULT: '#2563EB',
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563EB',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        'crimson': {
          DEFAULT: '#DC2626',
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#DC2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0, 0, 0, 0.1)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.15)',
        'navy-focus': '0 0 0 3px rgba(30, 74, 141, 0.2)',
        'glow-blue': '0 0 15px rgba(37, 99, 235, 0.3)',
        'glow-crimson': '0 0 15px rgba(220, 38, 38, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
        'fade-in-up': 'fadeInUp 0.6s ease-out',
        'pulse-subtle': 'pulseSubtle 3s ease-in-out infinite',
        'border-beam': 'borderBeam 4s linear infinite',
        'scan-sweep': 'scanSweep 0.6s ease-out',
        'data-ping': 'dataPing 0.3s ease-in-out',
        'horizon-drift': 'horizonDrift 20s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        borderBeam: {
          '0%': { '--beam-angle': '0deg' },
          '100%': { '--beam-angle': '360deg' },
        },
        scanSweep: {
          '0%': { top: '0%', opacity: '1' },
          '100%': { top: '100%', opacity: '0' },
        },
        dataPing: {
          '0%': { opacity: '0.4' },
          '50%': { opacity: '1' },
          '100%': { opacity: '0.4' },
        },
        horizonDrift: {
          '0%': { backgroundPosition: '0% 0%' },
          '100%': { backgroundPosition: '100% 100%' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-gradient': 'linear-gradient(to bottom, #f0f4f9 0%, #ffffff 50%, #f8fafc 100%)',
        'chrome-gradient': 'linear-gradient(135deg, #FFFFFF 0%, #94A3B8 25%, #FFFFFF 50%, #64748B 75%, #FFFFFF 100%)',
        'horizon-lines': 'repeating-linear-gradient(-45deg, transparent, transparent 10px, rgba(56, 178, 172, 0.03) 10px, rgba(56, 178, 172, 0.03) 11px)',
      },
    },
  },
  plugins: [],
}
