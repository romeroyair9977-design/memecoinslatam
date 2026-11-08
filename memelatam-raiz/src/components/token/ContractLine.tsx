'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { explorerUrl } from '@/lib/chains';

/** Contrato completo, siempre visible, con botón de copiar y enlace al explorador. */
export function ContractLine({ chain, address }: { chain: string; address: string }) {
  const [copied, setCopied] = useState(false);
  const url = explorerUrl(chain, address);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* sin permiso de portapapeles: se ignora */ }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-line bg-panel px-3 py-1.5 text-xs">
      <span className="text-muted">Contrato</span>
      <code className="break-all font-mono text-ink">{address}</code>
      <button type="button" onClick={() => void copy()} aria-label="Copiar contrato" className="flex items-center gap-1 text-muted hover:text-ink">
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
        {copied ? 'Copiado' : 'Copiar'}
      </button>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Ver en el explorador" className="text-muted hover:text-ink">
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      )}
    </div>
  );
}
