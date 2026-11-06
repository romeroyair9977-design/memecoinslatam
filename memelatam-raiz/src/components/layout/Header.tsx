import Link from 'next/link';
import { PARENT, SITE } from '@/lib/config';
import { SearchBar } from '@/components/search/SearchBar';
import { UserMenu } from '@/components/auth/UserMenu';

const NAV = [
  { href: '/tendencias-x', label: 'Tendencias en X' },
  { href: '/#dashboard', label: 'Dashboard' },
  { href: '/scan', label: 'Scan' },
  { href: '/ballenas', label: 'Ballenas' },
  { href: '/comunidad', label: 'Comunidad' },
  { href: '/ranking', label: 'Predictores' },
  { href: '/actividad', label: 'Actividad' },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <div className="leading-none">
          <Link href="/" className="font-display text-xl font-bold tracking-tight">{SITE.name}</Link>
          <a href={PARENT.url} className="mt-0.5 hidden text-[10px] text-muted hover:text-ink sm:block">por {PARENT.name}</a>
        </div>
        <nav aria-label="Principal" className="hidden items-center gap-4 text-sm text-muted sm:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-ink">{n.label}</Link>
          ))}
        </nav>
        <div className="ml-auto hidden w-full max-w-md md:block">
          <SearchBar size="sm" />
        </div>
        <div className="ml-auto md:ml-0"><UserMenu /></div>
      </div>
      {/* Móvil: la navegación y el buscador viven en una segunda fila */}
      <div className="space-y-2 border-t border-line px-4 py-2 md:hidden">
        <nav aria-label="Principal (móvil)" className="flex gap-4 overflow-x-auto whitespace-nowrap text-sm text-muted sm:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-ink">{n.label}</Link>
          ))}
        </nav>
        <SearchBar size="sm" />
      </div>
    </header>
  );
}
