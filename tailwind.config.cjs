module.exports = {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      borderColor: {
        input: 'var(--border-input)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
