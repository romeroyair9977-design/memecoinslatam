/** Tipos de dominio de la app (normalizados; independientes del formato crudo de cada API). */

export type TimeWindow = 'm5' | 'h1' | 'h6' | 'h24';

export interface TokenRef {
  address: string;
  name: string;
  symbol: string;
}

export interface SocialLink {
  /** twitter | telegram | discord | website | otro */
  type: string;
  url: string;
  label?: string;
}

/** Un par de liquidez (pool) en un DEX, normalizado desde DexScreener. */
export interface Pair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: TokenRef;
  quoteToken: TokenRef;
  priceUsd: number;
  priceNative: number;
  txns: Record<TimeWindow, { buys: number; sells: number }>;
  volume: Record<TimeWindow, number>;
  priceChange: Record<TimeWindow, number>;
  liquidityUsd: number;
  fdv: number;
  marketCap: number;
  /** Timestamp en ms de creación del par; null si DexScreener no lo informa. */
  pairCreatedAt: number | null;
  imageUrl: string | null;
  websites: SocialLink[];
  socials: SocialLink[];
  boostsActive: number;
}

export interface Holder {
  address: string;
  /** % del supply (0–100) */
  pct: number;
  amount?: number;
  /** Marcado como insider/sniper por la fuente (RugCheck) */
  isInsider?: boolean;
}

export interface HolderStats {
  source: 'rugcheck' | 'geckoterminal';
  totalHolders: number | null;
  /** % del supply en los 10 mayores holders (0–100) */
  top10Pct: number | null;
  top1Pct: number | null;
  /** Lista de top holders (solo disponible con RugCheck / Solana por ahora) */
  holders: Holder[];
}

/** Señales de seguridad on-chain (RugCheck, solo Solana por ahora). */
export interface SecuritySignals {
  rugged: boolean;
  mintAuthorityActive: boolean;
  freezeAuthorityActive: boolean;
  /** Descripciones de riesgos nivel "danger" reportados por RugCheck */
  dangerRisks: string[];
}

/** Metadata de GeckoTerminal. */
export interface TokenInfo {
  description: string | null;
  websites: string[];
  twitterHandle: string | null;
  telegramHandle: string | null;
  discordUrl: string | null;
  gtScore: number | null;
  categories: string[];
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskFlag {
  id: string;
  severity: 'ok' | 'info' | 'warn' | 'danger';
  label: string;
  detail: string;
}

export interface RiskScore {
  /** 0 (más seguro) – 100 (más riesgoso). Heurístico, NO es garantía. */
  score: number;
  level: RiskLevel;
  flags: RiskFlag[];
}

export type ActivityStatus = 'fantasma' | 'tibio' | 'activo';

export interface Activity {
  status: ActivityStatus;
  reasons: string[];
}

export interface Token {
  address: string;
  chain: string;
  name: string;
  symbol: string;
  imageUrl: string | null;
  /** Par principal (mayor liquidez) */
  pair: Pair;
  pairs: Pair[];
  /** Otras chains donde existe la misma dirección (poco común, típico en EVM) */
  alternativeChains: { chain: string; liquidityUsd: number }[];
  holders: HolderStats | null;
  security: SecuritySignals | null;
  info: TokenInfo | null;
  risk: RiskScore;
  activity: Activity;
  links: SocialLink[];
  updatedAt: number;
}

export type TokenResult =
  | { status: 'ok'; token: Token }
  | { status: 'invalid' }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

/** Versión liviana para tarjetas del dashboard. */
export type Category = 'new' | 'traction' | 'migrating';

export interface TokenSummary {
  chain: string;
  address: string;
  name: string;
  symbol: string;
  imageUrl: string | null;
  priceUsd: number;
  change24h: number;
  marketCap: number;
  liquidityUsd: number;
  volume24h: number;
  txns24h: number;
  pairCreatedAt: number | null;
  dexId: string;
  tags: Category[];
  activity: ActivityStatus;
  trendScore: number;
}

export interface Dashboard {
  nuevas: TokenSummary[];
  traccion: TokenSummary[];
  migrando: TokenSummary[];
  trending: TokenSummary[];
  updatedAt: number;
}
