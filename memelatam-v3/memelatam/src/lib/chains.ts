export interface ChainMeta {
  /** id de DexScreener */
  id: string;
  label: string;
  /** id de red en GeckoTerminal */
  gecko: string;
  explorer: string;
}

export const CHAINS: Record<string, ChainMeta> = {
  solana: { id: 'solana', label: 'Solana', gecko: 'solana', explorer: 'https://solscan.io/account/' },
  ethereum: { id: 'ethereum', label: 'Ethereum', gecko: 'eth', explorer: 'https://etherscan.io/address/' },
  base: { id: 'base', label: 'Base', gecko: 'base', explorer: 'https://basescan.org/address/' },
  bsc: { id: 'bsc', label: 'BNB Chain', gecko: 'bsc', explorer: 'https://bscscan.com/address/' },
  arbitrum: { id: 'arbitrum', label: 'Arbitrum', gecko: 'arbitrum', explorer: 'https://arbiscan.io/address/' },
  polygon: { id: 'polygon', label: 'Polygon', gecko: 'polygon_pos', explorer: 'https://polygonscan.com/address/' },
  avalanche: { id: 'avalanche', label: 'Avalanche', gecko: 'avax', explorer: 'https://snowtrace.io/address/' },
};

const GECKO_TO_DEX: Record<string, string> = Object.fromEntries(
  Object.values(CHAINS).map((c) => [c.gecko, c.id]),
);

export const isSupportedChain = (id: string) => id in CHAINS;
export const chainLabel = (id: string) => CHAINS[id]?.label ?? id;
export const toGeckoNetwork = (id: string) => CHAINS[id]?.gecko ?? null;
export const fromGeckoNetwork = (net: string) => GECKO_TO_DEX[net] ?? null;
export const explorerUrl = (chain: string, address: string) =>
  CHAINS[chain] ? `${CHAINS[chain].explorer}${address}` : null;
