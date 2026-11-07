'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

const COMMUNITY = [
  { href: '/comunidad', label: 'Chat y comunidades' },
  { href: '/ranking', label: 'Ranking de predictores' },
  { href: '/actividad', label: 'Actividad' },
];

/**
 * Navegación principal en orden de uso: Tendencias en X → Dashboard → Comunidad (menú con Chat, Ranking y Actividad).
 * Tres pestañas en vez de cinco; el menú se cierra con Escape, con clic afuera o al elegir una opción.
 */
export function MainNav({ label, className }: { label: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <nav aria-label={label} className={className}>
      <Link href="/tendencias-x" className="whitespace-nowrap hover:text-ink">Tendencias en X</Link>
      <Link href="/#dashboard" className="whitespace-nowrap hover:text-ink">Dashboard</Link>
      <div ref={box} className="relative">
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="true"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 whitespace-nowrap hover:text-ink"
        >
          Comunidad <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        {open && (
          <ul className="absolute left-0 top-full z-50 mt-2 min-w-48 rounded-lg border border-line bg-panel p-1 shadow-lg">
            {COMMUNITY.map((c) => (
              <li key={c.href}>
                <Link href={c.href} onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm text-ink hover:bg-panel2">
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}
