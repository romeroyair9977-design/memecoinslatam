'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { explorerUrl } from '@/lib/chains';
import { shortAddress } from '@/lib/utils';

/** Contrato del token: completo en pantallas grandes (corto en celular), con botón de copiar y link al explorador. */
export function ContractChip({ chain, address }: { chain: string; address: string }) {
  const [copied, setCopied] = useState(false);
  const url = explorerUrl(chain, address);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1_500);
    } catch {
      /* sin permiso de portapapeles: el texto se puede seleccionar a mano */
    }
  }

  return (
    <div className="mt-2 flex max-w-full items-center gap-1 rounded-lg border border-line bg-panel px-2 py-1 text-xs">
      <span className="shrink-0 text-muted">Contrato</span>
      <code className="min-w-0 select-all break-all font-mono text-ink">
        <span className="hidden sm:inline">{address}</span>
        <span className="sm:hidden">{shortAddress(address, 6)}</span>
      </code>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={copied ? 'Contrato copiado' : 'Copiar contrato'}
        className="ml-1 flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-muted hover:bg-panel2 hover:text-brand"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
        <span>{copied ? 'Copiado' : 'Copiar'}</span>
      </button>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Ver en el explorador" className="shrink-0 rounded-md p-1 text-muted hover:bg-panel2 hover:text-brand">
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      )}
    </div>
  );
}
