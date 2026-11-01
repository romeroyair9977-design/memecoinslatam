# MemeLatam (MVP)

Plataforma en español para la comunidad latina de memecoins: buscador por contract address,
análisis de holders/riesgo, dashboard de tokens nuevos / con tracción / migrando, chat y tesis.

## Arranque
```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
npm run typecheck
```
No requiere API keys (DexScreener, GeckoTerminal y RugCheck son públicas).

## Probar
- Home: `/`
- Token: `/token/<contract>` (Solana o EVM). Si la misma dirección existe en varias chains: `?chain=base`.

## Estructura
Ver `src/`: `app/` (rutas), `components/`, `lib/services/` (APIs), `lib/risk.ts`, `lib/classify.ts`, `types/`.

## Notas
- Cache en memoria (`lib/cache.ts`) + `fetch` revalidate. En Vercel es por instancia: para producción usa Upstash/Vercel KV.
- Límites aprox.: DexScreener 300 req/min (perfiles/boosts 60/min), GeckoTerminal ~30/min, RugCheck variable.
- Esto no es asesoría financiera. El score de riesgo es heurístico.

## Deploy en Netlify
1. Sube el repo a GitHub y en Netlify: *Add new site → Import from Git*.
2. Build command `npm run build` (ya está en `netlify.toml`); Netlify detecta Next.js solo.
3. En *Site configuration → Environment variables* añade las de `.env.example`
   (`NEXT_PUBLIC_SITE_URL` = tu URL de Netlify o dominio propio, y las de Discord si usas el chat).
4. Notas serverless:
   - El cache en memoria (`lib/cache.ts`) es por función y se pierde en cold starts: sirve para amortiguar, no para garantizar.
   - Las funciones tienen timeout corto (10 s por defecto): por eso la home usa `revalidate = 60` y los fetch tienen timeout de 8 s.
   - Para escalar: Netlify Blobs o Upstash Redis como cache compartido, y un job programado (Scheduled Function) que precalcule el dashboard.
