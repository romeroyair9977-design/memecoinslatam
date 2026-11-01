import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="font-display text-3xl font-semibold">Esta página no existe</h1>
      <p className="mt-2 text-muted">Revisa el enlace o busca un token por su contract address.</p>
      <Link href="/" className="mt-6 inline-block rounded-lg bg-brand px-4 py-2 font-medium text-bg">
        Volver al inicio
      </Link>
    </div>
  );
}
