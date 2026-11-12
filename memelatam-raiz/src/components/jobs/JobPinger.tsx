'use client';

import { useEffect } from 'react';

let pinged = false;

/**
 * No dibuja nada. Al abrir el sitio avisa al servidor para que corra, si le toca, las tareas periódicas
 * (llamados de Potencial y resolución de predicciones). El servidor las limita con un candado, así que no importa
 * cuántas personas entren: se ejecutan como máximo una vez por intervalo.
 */
export function JobPinger() {
  useEffect(() => {
    if (pinged) return;
    pinged = true;
    for (const job of ['potencial', 'predicciones']) {
      fetch(`/api/jobs/${job}`, { method: 'POST' }).catch(() => undefined);
    }
  }, []);
  return null;
}
