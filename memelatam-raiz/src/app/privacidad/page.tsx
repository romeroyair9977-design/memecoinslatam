import type { Metadata } from 'next';
import { SITE } from '@/lib/config';

export const metadata: Metadata = { title: 'Privacidad y publicidad' };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-4 py-6 text-sm leading-relaxed">
      <h1 className="font-display text-3xl font-bold">Privacidad y publicidad</h1>
      <p className="text-muted">{SITE.name} es una plataforma de información de {SITE.brand}. No es asesoría financiera ni custodia fondos.</p>
      <h2 className="font-display text-lg font-semibold">Publicidad</h2>
      <p>Mostramos anuncios de Google AdSense. Google y sus socios pueden usar cookies para mostrar anuncios según tus visitas a este y otros sitios. Puedes gestionar la personalización en <a className="text-brand hover:underline" href="https://adssettings.google.com" rel="noopener noreferrer">adssettings.google.com</a>.</p>
      <h2 className="font-display text-lg font-semibold">Datos de tu cuenta</h2>
      <p>Si creas una cuenta guardamos tu correo o dirección de wallet, tu nombre de usuario, tus mensajes y tesis públicas, y las wallets que decidas guardar (estas últimas solo las ves tú). Nunca pedimos tu frase semilla ni claves privadas; firmar un mensaje para entrar no da acceso a tus fondos.</p>
      <h2 className="font-display text-lg font-semibold">Datos de mercado</h2>
      <p>Los precios y métricas vienen de DexScreener, GeckoTerminal y RugCheck, pueden tener retraso o errores y no son una recomendación de compra o venta.</p>
    </article>
  );
}
