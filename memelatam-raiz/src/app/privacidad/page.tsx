import type { Metadata } from 'next';
import { PARENT, SITE } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Política de privacidad y publicidad',
  description: `Cómo ${SITE.name} trata tus datos, qué cookies usa y cómo funcionan los anuncios.`,
};

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? '';

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-6 py-4 text-sm leading-relaxed">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold">Política de privacidad y publicidad</h1>
        <p className="text-muted">{SITE.name} es un producto de {PARENT.name}. Última actualización: noviembre de 2026.</p>
      </header>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">Qué datos guardamos</h2>
        <p>Si creas una cuenta guardamos tu correo (o la dirección pública de tu wallet), tu nombre de usuario, tus mensajes, tesis, predicciones, wallets que sigues y tu saldo de $LATAM. Si solo navegas, no necesitas cuenta y no guardamos tus búsquedas en nuestra base de datos.</p>
        <p>Los $LATAM son puntos internos de la plataforma. No son dinero, no son una criptomoneda y no se pueden retirar.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">Cookies y publicidad</h2>
        <p>Usamos cookies necesarias para mantener tu sesión iniciada. También mostramos anuncios de Google AdSense. Google y sus socios pueden usar cookies para mostrar anuncios según tus visitas a este y otros sitios.</p>
        <p>
          Puedes gestionar o desactivar la personalización de anuncios en{' '}
          <a className="text-brand underline" href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">adssettings.google.com</a>, y leer cómo Google usa los datos en{' '}
          <a className="text-brand underline" href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer">policies.google.com/technologies/ads</a>.
        </p>
        <p>Los anuncios están siempre etiquetados como &quot;Publicidad&quot;. {SITE.name} no recomienda ni respalda los productos anunciados.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">Servicios de terceros</h2>
        <p>Mostramos datos de mercado de DexScreener, GeckoTerminal y RugCheck, y menciones públicas de X obtenidas mediante un proveedor de datos. Alojamos la plataforma en Netlify y las cuentas en Supabase. Cada uno tiene su propia política de privacidad.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">No es asesoría financiera</h2>
        <p>La información de esta plataforma es solo informativa. Las memecoins son activos de altísimo riesgo y puedes perder todo lo que inviertas. Los puntajes de riesgo son heurísticas, no garantías.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">Tus derechos y contacto</h2>
        <p>Puedes pedir que borremos tu cuenta y tus datos en cualquier momento{CONTACT ? <> escribiendo a <a className="text-brand underline" href={`mailto:${CONTACT}`}>{CONTACT}</a></> : ' a través de los canales oficiales de la plataforma'}.</p>
      </section>
    </article>
  );
}
