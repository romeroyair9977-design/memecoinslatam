export interface XTrendToken {
  chain: string;
  address: string;
  symbol: string;
  name: string;
  imageUrl: string | null;
  priceUsd: number;
  change24h: number;
  liquidityUsd: number;
  marketCap: number;
}

export interface XTrendItem {
  /** '$pepe' o contract address */
  term: string;
  kind: 'cashtag' | 'address';
  mentions: number;
  authors: number;
  /** likes + retweets + respuestas de los tweets contados */
  engagement: number;
  recent: number;
  previous: number;
  /** >1 = se menciona más rápido que antes */
  momentum: number;
  token: XTrendToken;
  /** El símbolo existe en varios tokens con liquidez parecida: el enlace puede apuntar a otro. */
  ambiguous: boolean;
}

export interface XTrendsResult {
  items: XTrendItem[];
  hours: number;
  updatedAt: number;
  /** Cuándo corrió el último escaneo de X (ISO). null si nunca ha corrido. */
  lastScanAt: string | null;
}

export interface XTweet {
  id: string;
  author: string;
  text: string;
  /** Traducción al español (solo si hay DEEPL_API_KEY y el tweet no está en español) */
  textEs: string | null;
  lang: string | null;
  likes: number;
  retweets: number;
  replies: number;
  views: number;
  at: string;
  url: string | null;
}
