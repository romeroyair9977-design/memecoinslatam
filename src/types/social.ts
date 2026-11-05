export type TrendWindow = '1h' | '6h' | '24h';

export interface TrendAuthor {
  username: string;
  name: string;
  followers: number;
  /** Perfil en X: al tocarlo se abre directo. */
  url: string;
}

export interface TrendTweet {
  id: string;
  author: TrendAuthor | null;
  text: string;
  lang: string;
  likes: number;
  reposts: number;
  replies: number;
  url: string;
}

export interface TrendItem {
  key: string;
  symbol: string;
  name: string | null;
  chain: string | null;
  /** Contrato detectado en los tweets (si lo hubo). */
  address: string | null;
  mentions: number;
  /** Menciones en la segunda mitad de la ventana (lo más reciente). */
  recentMentions: number;
  /** recientes / anteriores: >1 = se está hablando más ahora que antes. */
  momentum: number;
  engagement: number;
  /** Encontrado en DexScreener con liquidez → ya tiene análisis. */
  indexed: boolean;
  liquidityUsd: number;
  priceUsd: number | null;
  change24h: number | null;
  topTweet: TrendTweet | null;
  /** Cuenta oficial del proyecto en X (la que declara en DexScreener/GeckoTerminal), si existe. */
  projectX: string | null;
  /** Cuentas que más hablan de la moneda (por seguidores). */
  voices: TrendAuthor[];
}

export interface TrendsResponse {
  configured: boolean;
  window: TrendWindow;
  items: TrendItem[];
  /** Momento en que se calcularon los datos (no cuando se pidió la página). */
  updatedAt: number;
  /** Cada cuántos segundos se recalcula esta ventana. */
  refreshSeconds: number;
}
