/**
 * Identidad y dominio. TODO sale de aquí (o de variables de entorno): el día que cambies de dominio solo
 * tienes que cambiar `NEXT_PUBLIC_SITE_URL` (y `NEXT_PUBLIC_PARENT_URL` si cambia la marca madre) en el hosting.
 */
export const SITE = {
  name: 'Veltrix Coin', // plataforma de memecoins; vive como subdominio de Veltrix Colombia
  brand: 'Veltrix Colombia', // marca / dominio madre
  tagline: 'Memecoins con ojo latino',
  description:
    'Busca cualquier memecoin por contract address, revisa holders y riesgo de rug, y comparte tu tesis con la comunidad latina.',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  parentUrl: process.env.NEXT_PUBLIC_PARENT_URL ?? 'https://veltrixcolombia.com',
} as const;

/**
 * Google AdSense. El script se carga una sola vez en el layout (basta con uno aunque haya varios anuncios).
 * `slots` son los IDs de bloque de anuncio que creas en AdSense (Anuncios → Por unidad de anuncio). Si un slot
 * está vacío, ese espacio no se muestra y Google puede usar "Anuncios automáticos" si los activas en su panel.
 */
export const ADS = {
  client: process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? 'ca-pub-8224814547041917',
  slots: {
    home: process.env.NEXT_PUBLIC_AD_SLOT_HOME ?? '',
    sidebar: process.env.NEXT_PUBLIC_AD_SLOT_SIDEBAR ?? '',
    token: process.env.NEXT_PUBLIC_AD_SLOT_TOKEN ?? '',
    ranking: process.env.NEXT_PUBLIC_AD_SLOT_RANKING ?? '',
  },
} as const;

/** TTLs de cache (ms). Precios cambian rápido; holders y metadata, mucho menos. */
export const TTL = {
  price: 30_000,
  dashboard: 20_000,
  /** Después del TTL se sigue sirviendo el dato viejo (al instante) mientras se recalcula en segundo plano. */
  dashboardStale: 10 * 60_000,
  holders: 5 * 60_000,
  info: 10 * 60_000,
} as const;

/** Mensajes que se cargan al abrir una sala (el resto se pide con "Cargar anteriores"). */
export const MESSAGE_SHAPE_LIMIT = 60;

/** Cada cuánto el navegador vuelve a pedir /api/dashboard para mostrar memecoins nuevas (ms). */
export const DASHBOARD_POLL_MS = 20_000;
