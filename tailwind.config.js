/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'boulders-dark': '#1a1a1a',
        'boulders-purple': '#8B5CF6',
        'boulders-magenta': '#EC4899',
        'boulders-pink': '#F472B6',
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

