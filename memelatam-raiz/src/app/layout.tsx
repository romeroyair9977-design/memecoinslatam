import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, DM_Sans } from 'next/font/google';
import Script from 'next/script';
import { UserProvider } from '@/components/auth/UserProvider';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ADSENSE, PARENT, SITE } from '@/lib/config';
import './globals.css';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = DM_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} · ${SITE.tagline}`, template: `%s · ${SITE.name}` },
  description: SITE.description,
  openGraph: { type: 'website', locale: 'es_LA', siteName: SITE.name, title: SITE.name, description: SITE.description },
  twitter: { card: 'summary_large_image' },
  authors: [{ name: PARENT.name, url: PARENT.url }],
  publisher: PARENT.name,
  // Verificación de propiedad del sitio en Google AdSense.
  other: { 'google-adsense-account': ADSENSE.client },
};

export const viewport: Viewport = { themeColor: '#0d1221', colorScheme: 'dark' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`}>
      <head>
        {/* Un solo script de AdSense para todo el sitio (el fragmento que pegaste estaba duplicado). */}
        <Script
          id="adsense"
          async
          strategy="beforeInteractive"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE.client}`}
          crossOrigin="anonymous"
        />
      </head>
      <body className="flex min-h-screen flex-col">
        <UserProvider>
          <Header />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
          <Footer />
        </UserProvider>
      </body>
    </html>
  );
}
