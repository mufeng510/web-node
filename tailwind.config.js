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
        'destructive-hover': 'rgb(var(--destructive-hover))',
        'destructive-fg': 'rgb(var(--destructive-fg))',
        success: 'rgb(var(--success))',
        'success-fg': 'rgb(var(--success-fg))',
        overlay: 'rgb(var(--overlay))',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      // Values mirror Tailwind's defaults exactly (verified 1:1), so wiring them
      // changes no rendered pixel — it only makes tokens.css the real source of
      // truth, which its header already claims to be.
      spacing: {
        1: 'var(--space-1)',
        2: 'var(--space-2)',
        3: 'var(--space-3)',
        4: 'var(--space-4)',
        5: 'var(--space-5)',
        6: 'var(--space-6)',
        8: 'var(--space-8)',
        10: 'var(--space-10)',
        12: 'var(--space-12)',
      },
      fontSize: {
        xs: 'var(--text-xs)',
        sm: 'var(--text-sm)',
        base: 'var(--text-base)',
        lg: 'var(--text-lg)',
        xl: 'var(--text-xl)',
        '2xl': 'var(--text-2xl)',
        '3xl': 'var(--text-3xl)',
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
