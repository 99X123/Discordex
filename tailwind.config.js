/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        signal: {
          bg: '#0A1613',
          secondary: '#101E1A',
          surface: '#1A2E27',
          hover: '#23392F',
          border: 'rgba(237, 234, 225, 0.08)',
          success: '#4FB286',
          warning: '#E2853B',
          danger: '#D9604B',
          text: {
            primary: '#EDEAE1',
            secondary: '#93A69B',
          }
        },
        brass: {
          DEFAULT: '#D9A44A',
          hover: '#E8BE72',
          dark: '#B9862F',
          glow: 'rgba(217, 164, 74, 0.35)',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Space Grotesk"', '"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      spacing: {
        '4.5': '1.125rem',
        '7.5': '1.875rem',
      },
      boxShadow: {
        'brass': '0 4px 14px 0 rgba(217, 164, 74, 0.30)',
        'brass-lg': '0 8px 32px 0 rgba(217, 164, 74, 0.40)',
        'float': '0 8px 24px -6px rgba(3, 8, 6, 0.65)',
        'float-lg': '0 16px 40px -8px rgba(3, 8, 6, 0.75)',
      },
      animation: {
        'transmit-pulse': 'transmitPulse 0.9s ease-in-out infinite',
        'dial-turn': 'dialTurn 0.15s ease-out forwards',
        'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-out forwards',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        transmitPulse: {
          '0%, 100%': { transform: 'scaleY(0.2)' },
          '25%': { transform: 'scaleY(1)' },
          '50%': { transform: 'scaleY(0.35)' },
          '75%': { transform: 'scaleY(0.75)' },
        },
        dialTurn: {
          '0%': { transform: 'rotate(-8deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '.8', transform: 'scale(1.02)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.96)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
