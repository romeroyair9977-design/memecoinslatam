import Link from 'next/link';
import { SITE } from '@/lib/config';
import { SearchBar } from '@/components/search/SearchBar';
import { UserMenu } from '@/components/auth/UserMenu';

const NAV = [
  { href: '/#dashboard', label: 'Dashboard' },
  { href: '/comunidad', label: 'Comunidad' },
  { href: '/actividad', label: 'Actividad' },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="font-display text-xl font-bold tracking-tight">
          {SITE.name}
        </Link>
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
        <nav aria-label="Principal (móvil)" className="flex gap-4 text-sm text-muted sm:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-ink">{n.label}</Link>
          ))}
        </nav>
        <SearchBar size="sm" />
      </div>
    </header>
  );
}
