'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Ejecuta `fn` cada `intervalMs` mientras la pestaña esté visible. Al volver a la pestaña refresca de inmediato.
 * No solapa llamadas: espera a que termine una para programar la siguiente.
 */
export function usePolling(fn: () => Promise<void>, intervalMs: number, enabled = true) {
  const saved = useRef(fn);
  saved.current = fn;

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (!document.hidden) {
        try { await saved.current(); } catch { /* el siguiente ciclo reintenta */ }
      }
      if (!stopped) timer = setTimeout(tick, intervalMs);
    };
    timer = setTimeout(tick, intervalMs);

    const onVisible = () => {
      if (document.hidden || stopped) return;
      if (timer) clearTimeout(timer);
      void tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs, enabled]);
}

/** Reloj. Devuelve null hasta montar (evita diferencias entre el HTML del servidor y el navegador). */
export function useNow(intervalMs: number): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
