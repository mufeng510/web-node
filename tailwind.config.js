/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/frontend/index.html', './src/frontend/src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg))',
        'bg-elevated': 'rgb(var(--bg-elevated))',
        'bg-hover': 'rgb(var(--bg-hover))',
        fg: 'rgb(var(--fg))',
        'fg-muted': 'rgb(var(--fg-muted))',
        'fg-subtle': 'rgb(var(--fg-subtle))',
        border: 'rgb(var(--border))',
        'border-strong': 'rgb(var(--border-strong))',
        primary: 'rgb(var(--primary))',
        'primary-hover': 'rgb(var(--primary-hover))',
        'primary-fg': 'rgb(var(--primary-fg))',
        ring: 'rgb(var(--ring))',
        destructive: 'rgb(var(--destructive))',
        'destructive-fg': 'rgb(var(--destructive-fg))',
        success: 'rgb(var(--success))',
        'success-fg': 'rgb(var(--success-fg))',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
      },
      transitionDuration: {
        fast: 'var(--transition-fast)',
        base: 'var(--transition-base)',
        slow: 'var(--transition-slow)',
      },
    },
  },
  plugins: [],
};
