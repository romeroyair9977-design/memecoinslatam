'use client';

import { useEffect, useRef } from 'react';
import { ADS } from '@/lib/config';
import { cn } from '@/lib/utils';

declare global {
  interface Window { adsbygoogle?: unknown[] }
}

type Slot = keyof typeof ADS.slots;

/**
 * Bloque de anuncio de Google AdSense. Reglas para no estorbar:
 *  - Reserva su alto (min-height) para que no mueva el contenido al cargar (sin saltos de layout).
 *  - Va SIEMPRE entre secciones, nunca encima de botones, tarjetas ni del chat.
 *  - Si no hay ID de bloque configurado, no renderiza nada (cero espacio vacío).
 * Cada <ins> se inicializa una sola vez (React Strict Mode lo monta dos veces en desarrollo).
 */
export function AdSlot({ slot, className, format = 'auto', minHeight = 100 }: { slot: Slot; className?: string; format?: 'auto' | 'rectangle' | 'horizontal'; minHeight?: number }) {
  const id = ADS.slots[slot];
  const ref = useRef<HTMLModElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!id || !el || el.getAttribute('data-adsbygoogle-status')) return;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* bloqueador de anuncios u otro error: se ignora */ }
  }, [id]);

  if (!id) return null;
  return (
    <aside aria-label="Publicidad" className={cn('overflow-hidden rounded-xl border border-line/60 bg-panel/30 p-2', className)} style={{ minHeight }}>
      <p className="mb-1 text-center text-[10px] uppercase tracking-wider text-muted">Publicidad</p>
      <ins
        ref={ref}
        className="adsbygoogle block"
        style={{ display: 'block' }}
        data-ad-client={ADS.client}
        data-ad-slot={id}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </aside>
  );
}
