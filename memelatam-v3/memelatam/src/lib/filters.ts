/**
 * Filtros por defecto de las 3 columnas + lógica de clasificación.
 * Código PURO (sin fetch ni APIs de servidor): lo usan el servidor y el navegador.
 *
 * Los valores por defecto son el extremo ESTRICTO de los rangos del brief; el usuario puede aflojarlos
 * en el panel de filtros avanzados. Cambia los números aquí y toda la app (columnas + panel) se ajusta.
 */
import type { ActivityStatus, ColumnId, TokenSummary } from '@/types/token';

const HOUR = 3_600_000;

export interface ColumnFilters {
  /** Edad del par en horas */
  ageMinH: number | null;
  ageMaxH: number | null;
  liqMin: number | null;
  liqMax: number | null;
  mcMin: number | null;
  mcMax: number | null;
  volMin: number | null;
  buysMin: number | null;
  sellsMin: number | null;
  /** Concentración máxima del top 10 (%). null = no filtrar. Si el dato es desconocido, el token pasa. */
  top10Max: number | null;
  /** Solo "Migrando": exigir presencia en ≥2 DEX o DEX de migración (pumpswap/raydium/meteora). */
  needsMigration: boolean;
}

export interface DashFilters {
  /** 'all' o id de chain de DexScreener (solana, base, …) */
  chain: string;
  columns: Record<ColumnId, ColumnFilters>;
}

const NONE: ColumnFilters = {
  ageMinH: null, ageMaxH: null, liqMin: null, liqMax: null, mcMin: null, mcMax: null,
  volMin: null, buysMin: null, sellsMin: null, top10Max: null, needsMigration: false,
};

export const COLUMN_META: Record<ColumnId, { title: string; description: string }> = {
  nuevas: { title: 'Recién lanzadas', description: 'Hasta 12 h de vida, con liquidez y volumen mínimos.' },
  traccion: { title: 'Con tracción', description: 'Entre 6 h y 4 días, liquidez y volumen sostenidos.' },
  migrando: { title: 'Migrando', description: 'Graduadas de pump.fun o presentes en varios DEX.' },
};

export const COLUMN_ORDER: ColumnId[] = ['nuevas', 'traccion', 'migrando'];

/** Concentración top 10 "preferida" por columna (solo ordena y colorea; no excluye). */
export const PREFERRED_TOP10: Partial<Record<ColumnId, number>> = { traccion: 40, migrando: 30 };

export const DEFAULT_FILTERS: DashFilters = {
  chain: 'all',
  columns: {
    // 1. Recién lanzadas: ≤12 h · liq ≥ $10K · MC ≤ $150K · vol 24h ≥ $4K
    nuevas: { ...NONE, ageMaxH: 12, liqMin: 10_000, mcMax: 150_000, volMin: 4_000 },
    // 2. Con tracción: 6 h–4 d · liq ≥ $30K · MC $100K–$800K · vol 24h ≥ $20K
    traccion: { ...NONE, ageMinH: 6, ageMaxH: 96, liqMin: 30_000, mcMin: 100_000, mcMax: 800_000, volMin: 20_000 },
    // 3. Migrando: ≥12 h · liq ≥ $60K · MC ≥ $300K · vol 24h ≥ $50K · multi-DEX / graduada
    migrando: { ...NONE, ageMinH: 12, liqMin: 60_000, mcMin: 300_000, volMin: 50_000, needsMigration: true },
  },
};

const MIGRATION_DEXES = ['pumpswap', 'raydium', 'meteora'];

export function isMigrated(t: TokenSummary): boolean {
  return t.dexCount >= 2 || MIGRATION_DEXES.includes(t.dexId);
}

const lt = (v: number, max: number | null) => max === null || v <= max;
const gt = (v: number, min: number | null) => min === null || v >= min;

export function matches(t: TokenSummary, f: ColumnFilters, now = Date.now()): boolean {
  const ageH = t.pairCreatedAt ? (now - t.pairCreatedAt) / HOUR : Infinity;
  if (!gt(ageH, f.ageMinH) || !lt(ageH, f.ageMaxH)) return false;
  if (!gt(t.liquidityUsd, f.liqMin) || !lt(t.liquidityUsd, f.liqMax)) return false;
  if (!gt(t.marketCap, f.mcMin) || !lt(t.marketCap, f.mcMax)) return false;
  if (!gt(t.volume24h, f.volMin)) return false;
  if (!gt(t.buys24h, f.buysMin) || !gt(t.sells24h, f.sellsMin)) return false;
  if (f.top10Max !== null && t.top10Pct !== null && t.top10Pct > f.top10Max) return false;
  if (f.needsMigration && !isMigrated(t)) return false;
  return true;
}

export type Columns = Record<ColumnId, TokenSummary[]>;

/**
 * Reparte los tokens en las 3 columnas. Un token vive en UNA sola columna
 * (prioridad Migrando > Con tracción > Recién lanzadas) para no repetir cards.
 */
export function buildColumns(tokens: TokenSummary[], filters: DashFilters, now = Date.now()): Columns {
  const pool = filters.chain === 'all' ? tokens : tokens.filter((t) => t.chain === filters.chain);
  const taken = new Set<string>();
  const key = (t: TokenSummary) => `${t.chain}:${t.address}`;
  const pick = (id: ColumnId): TokenSummary[] => {
    const out = pool.filter((t) => !taken.has(key(t)) && matches(t, filters.columns[id], now));
    const pref = PREFERRED_TOP10[id];
    const byAge = (a: TokenSummary, b: TokenSummary) => (b.pairCreatedAt ?? 0) - (a.pairCreatedAt ?? 0);
    const primary = id === 'traccion' ? (a: TokenSummary, b: TokenSummary) => b.volume24h - a.volume24h : byAge;
    out.sort((a, b) => {
      if (pref !== undefined) {
        const ga = a.top10Pct === null || a.top10Pct <= pref ? 0 : 1;
        const gb = b.top10Pct === null || b.top10Pct <= pref ? 0 : 1;
        if (ga !== gb) return ga - gb;
      }
      return primary(a, b);
    });
    const sliced = out.slice(0, 15);
    sliced.forEach((t) => taken.add(key(t)));
    return sliced;
  };
  // Se calcula en orden de prioridad pero se devuelve en orden visual.
  const migrando = pick('migrando');
  const traccion = pick('traccion');
  const nuevas = pick('nuevas');
  return { nuevas, traccion, migrando };
}

/** Badge visible según la columna: Fantasma / Poca actividad / Con vida. */
export function badgeFor(column: ColumnId, t: TokenSummary): ActivityStatus {
  if (t.liquidityUsd < 10_000) return 'fantasma';
  if (column === 'migrando') return t.activity === 'fantasma' ? 'tibio' : 'activo';
  if (column === 'traccion') return t.activity === 'activo' ? 'activo' : 'tibio';
  return t.activity; // nuevas: tal cual (fantasma si hay muy poca actividad)
}

export function activeFilterCount(f: ColumnFilters, base: ColumnFilters): number {
  return (Object.keys(f) as (keyof ColumnFilters)[]).filter((k) => f[k] !== base[k]).length;
}
