import type { Config } from 'tailwindcss';

// Les couleurs viennent de variables CSS (globals.css) => mode sombre sans duplication.
const v = (n: string) => `var(--${n})`;
export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'), surface: v('surface'), text: v('text'), muted: v('muted'),
        border: v('border'), primary: v('primary'), danger: v('danger'),
        ok: v('ok'), warn: v('warn'), anthracite: v('anthracite'),
      },
      borderRadius: { xl: '14px' },
    },
  },
  plugins: [],
} satisfies Config;
