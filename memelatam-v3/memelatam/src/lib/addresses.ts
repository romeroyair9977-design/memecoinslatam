export type AddressKind = 'evm' | 'solana';

const EVM_RE = /^0x[a-fA-F0-9]{40}$/;
const SOLANA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/; // base58

/** Detecta el tipo de dirección. Seguro de usar en cliente y servidor. */
export function detectAddressKind(input: string): AddressKind | null {
  const v = input.trim();
  if (EVM_RE.test(v)) return 'evm';
  if (SOLANA_RE.test(v)) return 'solana';
  return null;
}

/** Las direcciones EVM no distinguen mayúsculas; las de Solana (base58) SÍ. */
export const cacheSafeAddress = (a: string) => (detectAddressKind(a) === 'evm' ? a.toLowerCase() : a);
