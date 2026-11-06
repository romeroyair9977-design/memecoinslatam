'use client';

import { useEffect, useRef } from 'react';
import { ADSENSE } from '@/lib/config';
import { cn } from '@/lib/utils';

declare global {
  interface Window { adsbygoogle?: unknown[] }
}

interface Props {
  /** ID numérico del bloque de anuncios (AdSense → Anuncios → Por bloque de anuncios). Vacío = no se muestra nada. */
  slot: string;
  className?: string;
}

/**
 * Bloque de anuncio responsivo y claramente etiquetado ("Publicidad"). Reserva altura mínima para no mover la página
 * cuando carga. Se usa pocas veces y lejos de botones/acciones, para no provocar clics accidentales ni estorbar.
 */
export function AdSlot({ slot, className }: Props) {
  const pushed = useRef(false);

  useEffect(() => {
    if (!slot || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* el bloqueador de anuncios o AdSense aún no cargó: no pasa nada */
    }
  }, [slot]);

  if (!slot) return null;
  return (
    <aside aria-label="Publicidad" className={cn('mx-auto w-full max-w-4xl', className)}>
      <p className="mb-1 text-center text-[11px] text-muted">Publicidad</p>
      <ins
        className="adsbygoogle block min-h-[100px] overflow-hidden rounded-lg"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE.client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
