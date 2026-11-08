'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface Item { href: string; label: string }
interface Group { id: string; label: string; items: Item[] }

const LINKS: Item[] = [
  { href: '/tendencias-x', label: 'Tendencias en X' },
  { href: '/#dashboard', label: 'Dashboard' },
];

const GROUPS: Group[] = [
  {
    id: 'mercado',
    label: 'Mercado',
    items: [
      { href: '/scan', label: 'Ranking de memecoins' },
      { href: '/ballenas', label: 'Ballenas' },
      { href: '/potencial', label: 'Potencial x10 · x100 · x1000' },
    ],
  },
  {
    id: 'comunidad',
    label: 'Comunidad',
    items: [
      { href: '/comunidad', label: 'Chat y comunidades' },
      { href: '/predictores', label: 'Predictores' },
      { href: '/actividad', label: 'Actividad' },
    ],
  },
];

/**
 * Navegación principal con 4 entradas en vez de 8: Tendencias en X, Dashboard, Mercado ▾ (Ranking, Ballenas, Potencial)
 * y Comunidad ▾ (Chat, Predictores, Actividad). Los menús se cierran con Escape, clic afuera o al elegir.
 */
export function MainNav({ label, className }: { label: string; className?: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const nav = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!openId) return;
    const onDown = (e: MouseEvent) => { if (nav.current && !nav.current.contains(e.target as Node)) setOpenId(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenId(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openId]);

  return (
    <nav ref={nav} aria-label={label} className={className}>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="whitespace-nowrap hover:text-ink">{l.label}</Link>
      ))}
      {GROUPS.map((g) => (
        <div key={g.id} className="relative">
          <button
            type="button"
            aria-expanded={openId === g.id}
            aria-haspopup="true"
            onClick={() => setOpenId((cur) => (cur === g.id ? null : g.id))}
            className="flex items-center gap-1 whitespace-nowrap hover:text-ink"
          >
            {g.label}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openId === g.id ? 'rotate-180' : ''}`} aria-hidden />
          </button>
          {openId === g.id && (
            <ul className="absolute left-0 top-full z-50 mt-2 w-64 max-w-[85vw] rounded-lg border border-line bg-panel p-1 shadow-lg">
              {g.items.map((it) => (
                <li key={it.href}>
                  <Link href={it.href} onClick={() => setOpenId(null)} className="block rounded-md px-3 py-2 text-sm text-ink hover:bg-panel2">
                    {it.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </nav>
  );
}
