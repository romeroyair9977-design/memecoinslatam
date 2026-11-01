import Link from 'next/link';
import { SITE } from '@/lib/config';
import { SearchBar } from '@/components/search/SearchBar';

const NAV = [
  { href: '/#dashboard', label: 'Dashboard' },
  { href: '/#chat', label: 'Chat' },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="font-display text-xl font-bold tracking-tight">
          {SITE.name}
        </Link>
        <nav className="hidden items-center gap-4 text-sm text-muted sm:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-ink">{n.label}</Link>
          ))}
        </nav>
        <div className="ml-auto hidden w-full max-w-md md:block">
          <SearchBar size="sm" />
        </div>
      </div>
    </header>
  );
}
