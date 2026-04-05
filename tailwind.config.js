/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        hus: {
          navy:    '#1C2B3A',
          cream:   '#E8E0D4',
          gold:    '#C9A96E',
          'gold-dark': '#B08D4A',
          'gold-light': '#D4BC8A',
          teal:    '#2D5B6B',
          'teal-light': '#3A7A8F',
          paper:   '#FFFFFF',
          bg:      '#FAFAF8',
          border:  '#EBEBEB',
          text:    '#2D2D2D',
          'text-secondary': '#9A9A9A',
          'text-tertiary':  '#BBBBBB',
          muted:   '#9A9A9A',
          alert:   '#C0392B',
          success: '#3D7A5C',
          'navy-border': 'rgba(232,224,212,0.12)',
          'navy-hover':  'rgba(232,224,212,0.08)',
          'navy-active': 'rgba(201,169,110,0.15)',
        },
      },
      fontFamily: {
        sans:      ['Inter', 'system-ui', 'sans-serif'],
        serif:     ['"Noto Serif JP"', 'Georgia', 'serif'],
        cormorant: ['"Cormorant Garamond"', 'Georgia', 'serif'],
      },
      borderRadius: {
        card: '12px',
      },
      boxShadow: {
        card:  '0 1px 4px 0 rgba(26,18,8,0.06), 0 0 0 1px rgba(232,227,220,0.8)',
        'card-hover': '0 4px 16px 0 rgba(26,18,8,0.10), 0 0 0 1px rgba(201,169,110,0.2)',
        warm:  '0 4px 24px 0 rgba(60,40,10,0.10)',
        modal: '0 20px 60px 0 rgba(26,18,8,0.18)',
      },
    },
  },
  plugins: [],
}
