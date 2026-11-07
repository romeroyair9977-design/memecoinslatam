import Link from 'next/link';
import { PARENT, SITE } from '@/lib/config';
import { SearchBar } from '@/components/search/SearchBar';
import { UserMenu } from '@/components/auth/UserMenu';
import { MainNav } from '@/components/layout/MainNav';

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <div className="leading-none">
          <Link href="/" className="font-display text-xl font-bold tracking-tight">{SITE.name}</Link>
          <a href={PARENT.url} className="mt-0.5 hidden text-[10px] text-muted hover:text-ink sm:block">por {PARENT.name}</a>
        </div>
        <MainNav label="Principal" className="hidden items-center gap-4 text-sm text-muted sm:flex" />
        <div className="ml-auto hidden w-full max-w-md md:block">
          <SearchBar size="sm" />
        </div>
        <div className="ml-auto md:ml-0"><UserMenu /></div>
      </div>
      {/* Móvil: la navegación y el buscador viven en una segunda fila */}
      <div className="space-y-2 border-t border-line px-4 py-2 md:hidden">
        <MainNav label="Principal (móvil)" className="flex items-center gap-4 text-sm text-muted sm:hidden" />
        <SearchBar size="sm" />
      </div>
    </header>
  );
}
