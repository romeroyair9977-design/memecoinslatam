import type { Odds, CycleNum } from '@/lib/cycles';
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
}
