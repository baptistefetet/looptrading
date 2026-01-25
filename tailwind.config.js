/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/client/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Background colors
        dark: {
          900: '#0d1117',
          800: '#161b22',
          700: '#21262d',
          600: '#30363d',
        },
        // Neon accent colors
        neon: {
          green: '#00ff41',
          cyan: '#00d4ff',
          magenta: '#ff00ff',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
