'use client';

import { useEffect } from 'react';

let started = false;

function ping() {
  if (typeof document !== 'undefined' && document.hidden) return;
  for (const job of ['potencial', 'predicciones']) fetch(`/api/jobs/${job}`, { method: 'POST' }).catch(() => undefined);
}

/**
 * No dibuja nada. Va en el diseño general, así que corre en CUALQUIER página: al abrir el sitio y luego cada 10 minutos
 * mientras haya una pestaña visible. El servidor tiene un candado (Potencial: 1 corrida cada 10 min; predicciones: 1 por
 * hora para todos los visitantes juntos), así que no importa cuántas personas entren.
 */
export function JobPinger() {
  useEffect(() => {
    if (started) return;
    started = true;
    ping();
    setInterval(ping, 10 * 60_000);
  }, []);
  return null;
}
