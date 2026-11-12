import type { Odds, CycleNum } from '@/lib/cycles';
import type { MomentumState } from '@/lib/momentum';
import type { Multiple } from '@/lib/potential';
import type { WhaleHolder, WhaleRisk, WhaleScenario } from '@/lib/whales';

export interface WhaleToken {
  chain: string;
  address: string;
  symbol: string;
  name: string;
  imageUrl: string | null;
  marketCap: number;
  liquidityUsd: number;
  pairCreatedAt: number | null;
  /** 7 días o más de vida */
  established: boolean;
  whales: WhaleHolder[];
  /** Valor en USD de las 5 mayores ballenas juntas */
  whaleUsd: number;
  top1Pct: number;
  top3Pct: number;
  scenarios: WhaleScenario[];
  risk: WhaleRisk;
}
export interface WhaleBoard { items: WhaleToken[]; scanned: number; pending: number; updatedAt: number }

export interface ScanItem {
  chain: string;
  address: string;
  symbol: string;
  name: string;
  imageUrl: string | null;
  priceUsd: number;
  change24h: number;
  marketCap: number;
  liquidityUsd: number;
  volume24h: number;
  pairCreatedAt: number | null;
  top10Pct: number | null;
  cycle: CycleNum;
  /** null en el ciclo 3 (no hay siguiente) */
  odds: Odds | null;
  oddsScore: number | null;
  reasons: { text: string; good: boolean }[];
}
export interface ScanBoard { items: ScanItem[]; updatedAt: number }

export interface PotentialCall {
  id: string;
  chain: string;
  address: string;
  symbol: string;
  name: string;
  image: string | null;
  multiple: Multiple;
  entry_price: number;
  entry_mc: number;
  target_mc: number;
  score: number;
  reasons: string[];
  created_at: string;
  expires_at: string;
  status: 'open' | 'hit' | 'missed';
  peak_multiple: number;
  resolved_at: string | null;
  hit_at: string | null;
  /** par principal al momento del llamado (para revisar velas); null en llamados viejos */
  pair_address?: string | null;
  checked_at?: string | null;
}

export interface FomoItem {
  chain: string;
  address: string;
  pairAddress: string;
  symbol: string;
  name: string;
  imageUrl: string | null;
  dex: string;
  priceUsd: number;
  change5m: number;
  change1h: number;
  change24h: number;
  marketCap: number;
  liquidityUsd: number;
  volume1h: number;
  pairCreatedAt: number | null;
  /** compras por minuto en los últimos 5 min */
  buysPerMin: number;
  /** ritmo de compras de los últimos 5 min frente al resto de la hora (1 = igual) */
  accel: number;
  buyShare5: number;
  state: MomentumState;
  /** 0–100 */
  fomo: number;
  /** FOMO + equipo visible + liquidez (0–100). Es la "calidad" para ordenar, no una garantía */
  quality: number;
  reasons: { text: string; good: boolean }[];
  hasX: boolean;
  hasWebsite: boolean;
  ai: boolean;
  top10Pct: number | null;
}
export interface FomoBoard { items: FomoItem[]; scanned: number; updatedAt: number }
