export const SITE = {
  name: 'MemeLatam', // ← cambia aquí el nombre de la plataforma
  tagline: 'Memecoins con ojo latino',
  description:
    'Busca cualquier memecoin por contract address, revisa holders y riesgo de rug, y comparte tu tesis con la comunidad latina.',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
} as const;

/** TTLs de cache (ms). Precios cambian rápido; holders y metadata, mucho menos. */
export const TTL = {
  price: 30_000,
  dashboard: 60_000,
  holders: 5 * 60_000,
  info: 10 * 60_000,
} as const;
