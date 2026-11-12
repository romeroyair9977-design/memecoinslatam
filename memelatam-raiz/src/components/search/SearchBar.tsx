'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { detectAddressKind } from '@/lib/addresses';
import { cn } from '@/lib/utils';

interface Props {
  size?: 'sm' | 'lg';
  defaultValue?: string;
}

/** Busca por contract address (Solana o EVM) o por nombre/símbolo. La chain se autodetecta en el servidor. Se vacía al enviar. */
export function SearchBar({ size = 'lg', defaultValue = '' }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const v = value.trim();
    const isAddress = detectAddressKind(v) !== null;
    if (!isAddress && v.length < 2) {
      setError('Escribe el nombre o símbolo de la memecoin (mínimo 2 letras) o pega su contract address.');
      return;
    }
    setError(null);
    // Contrato → análisis directo. Nombre o símbolo → lista de resultados para elegir el token correcto.
    router.push(isAddress ? `/token/${v}` : `/buscar?q=${encodeURIComponent(v)}`);
    setValue(''); // se borra de inmediato: nadie queda con el contrato pegado en la barra
    (document.activeElement as HTMLElement | null)?.blur?.();
  }

  return (
    <form onSubmit={onSubmit} role="search" className="w-full">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          value={value}
          onChange={(e) => { setValue(e.target.value); if (error) setError(null); }}
          placeholder="Contrato o nombre (ej. TERESA)…"
          aria-label="Contract address, nombre o símbolo del token"
          spellCheck={false}
          autoComplete="off"
          className={cn(
            'w-full rounded-lg border border-line bg-panel pl-9 pr-24 text-ink placeholder:text-muted',
            size === 'lg' ? 'h-12 text-base' : 'h-9 text-sm',
          )}
        />
        <button
          type="submit"
          className={cn(
            'absolute right-1 top-1/2 -translate-y-1/2 rounded-md bg-brand font-medium text-bg hover:bg-brand-dim',
            size === 'lg' ? 'h-10 px-4 text-sm' : 'h-7 px-3 text-xs',
          )}
        >
          Analizar
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-rose-400">{error}</p>}
    </form>
  );
}
