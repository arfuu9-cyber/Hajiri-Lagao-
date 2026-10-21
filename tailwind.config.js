/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Noto Sans'", 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        concrete: {
          50: '#f4f8f6',
          100: '#e8f0ec',
          200: '#d5e3dc',
          300: '#bcd2c7',
        },
        // Legacy token name retained to avoid a risky app-wide class rename.
        // These values now implement the Hajiri Green brand ramp.
        navy: {
          50: '#e5f5ec',
          100: '#cbeadd',
          200: '#a1d8bd',
          300: '#73c39a',
          400: '#35a875',
          500: '#0a6b4b',
          600: '#085a40',
          700: '#074a35',
          800: '#063c2c',
          900: '#053326',
          950: '#02251b',
        },
        saffron: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        teal: {
          50: '#f0fdfa',
          100: '#ccfbef',
          200: '#99f6e0',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        coral: {
          50: '#fff5f3',
          100: '#ffe8e3',
          200: '#ffd0c7',
          300: '#ffb0a1',
          400: '#ff8a73',
          500: '#ff6b4a',
          600: '#f04e2c',
          700: '#cc3d1f',
          800: '#a8331d',
          900: '#8a2e1d',
        },
      },
    },
  },
  plugins: [],
};
