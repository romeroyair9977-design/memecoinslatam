import type { Config } from 'tailwindcss';

// Paleta: azul-tinta nocturno + amarillo cempasúchil como único acento.
// Los colores de estado (verde/rojo/ámbar) se reservan para datos y riesgo.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0d1221',
        panel: '#141b30',
        panel2: '#1b2442',
        line: '#2a3459',
        muted: '#8c97b8',
        ink: '#e8ecf8',
        brand: { DEFAULT: '#ffb02e', dim: '#c98a1f' },
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
