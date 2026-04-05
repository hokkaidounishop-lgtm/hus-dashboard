/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        hus: {
          bg:      '#EDECEA',
          paper:   '#FFFFFF',
          text:    '#1A1A1A',
          'text-secondary': '#666666',
          'text-tertiary':  '#999999',
          border:  'rgba(0,0,0,0.06)',
          muted:   '#999999',
          alert:   '#C0392B',
          success: '#3D7A5C',
          active:  '#1A1A1A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '8px',
      },
      boxShadow: {
        card:  'none',
        'card-hover': 'none',
        warm:  'none',
        modal: '0 20px 60px 0 rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
}
