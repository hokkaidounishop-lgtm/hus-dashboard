/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        hus: {
          bg:      '#EDECEA',
          sub:     '#f0efe9',
          paper:   '#ffffff',
          text:    '#1a1a18',
          'text-secondary': '#6b6b66',
          'text-tertiary':  '#9b9b94',
          border:  'rgba(0,0,0,0.08)',
          blue:    '#2563eb',
          pink:    '#db2777',
          teal:    '#0d9488',
          green:   '#16a34a',
          red:     '#dc2626',
          amber:   '#d97706',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      borderRadius: {
        card: '12px',
      },
      boxShadow: {
        card:  'none',
        'card-hover': 'none',
        modal: '0 20px 60px 0 rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
}
