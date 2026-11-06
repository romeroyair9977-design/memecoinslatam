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
  dashboard: 20_000,
  /** Precios "en vivo": cache muy corto en servidor para que varios usuarios compartan la misma consulta. */
  live: 3_000,
  holders: 5 * 60_000,
  info: 10 * 60_000,
} as const;

/** Mensajes que se cargan al abrir una sala (el resto se pide con "Cargar anteriores"). */
export const MESSAGE_SHAPE_LIMIT = 60;

/** Cada cuánto el navegador vuelve a pedir /api/dashboard para mostrar memecoins nuevas (ms). */
export const DASHBOARD_POLL_MS = 20_000;

/** Cada cuánto se refrescan SOLO los precios/números de las cards (consulta liviana, sin RugCheck). */
export const PRICE_POLL_MS = 6_000;

/** Cada cuánto se refresca el mercado de un token abierto (precio, volumen, compras/ventas). */
export const LIVE_POLL_MS = 4_000;

/** Marca madre. MemeLatam vive como producto dentro de Veltrix Colombia. Cambia aquí si compras otro dominio. */
export const PARENT = { name: 'Veltrix Colombia', url: 'https://veltrixcolombia.com' } as const;

/**
 * Google AdSense. El client id es público (va en el HTML). Los slots son los IDs numéricos de cada bloque que creas en
 * AdSense → Anuncios → Por bloque de anuncios. Si un slot está vacío, ese espacio NO se muestra (los Anuncios
 * automáticos de AdSense, si los activas, siguen funcionando por su cuenta).
 */
export const ADSENSE = {
  client: process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? 'ca-pub-8224814547041917',
  slotHome: process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME ?? '',
  slotToken: process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOKEN ?? '',
  slotRanking: process.env.NEXT_PUBLIC_ADSENSE_SLOT_RANKING ?? '',
} as const;
