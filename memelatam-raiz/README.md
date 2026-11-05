# Veltrix Coin (MVP) · por Veltrix Colombia

Plataforma en español para la comunidad latina de memecoins: buscador por contract address, análisis de
holders y riesgo, dashboard (Recién lanzadas / Con tracción / Migrando), **comunidades en tiempo real**
(General + una por token), tesis, perfiles, seguir wallets y feed de actividad.

Stack: Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (Auth + Postgres + Realtime + Storage).

## Arranque rápido (modo demo, sin Supabase)
```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
```
Sin variables de Supabase la app funciona en **modo demo**: dashboard y análisis con datos reales
(DexScreener, GeckoTerminal y RugCheck no piden API key); comunidades, tesis y actividad muestran datos de
ejemplo y la escritura está deshabilitada.

## Conectar Supabase (10 min)
1. Crea un proyecto en supabase.com.
2. **SQL Editor** → pega y ejecuta **en orden** `supabase/migrations/0001_init.sql` y luego `0002_latam.sql` ($LATAM, boosts, notificaciones). Crea tablas, RLS, triggers, Realtime,
   el bucket `chat-images` y la **Comunidad General**.
3. **Project Settings → API**: copia `URL` y `anon key` a `.env.local`, y `service_role key` a
   `SUPABASE_SERVICE_ROLE_KEY` (solo servidor; nunca con prefijo `NEXT_PUBLIC`).
4. **Authentication → URL Configuration**: Site URL = tu URL; añade `http://localhost:3000/auth/callback` y
   `https://TU-DOMINIO/auth/callback` a Redirect URLs.
5. **Authentication → Providers**: Email (activo por defecto) y **Web3 Wallet** (Solana y/o Ethereum) para
   "Entrar con wallet" (usa `signInWithWeb3`, requiere supabase-js ≥ 2.58).
6. Hazte admin: `update public.profiles set is_admin = true where username = 'tu_usuario';`
   Verás la cola de moderación en `/admin/reportes`.

## Rutas
| Ruta | Qué es |
|---|---|
| `/` | Ticker + dashboard de 3 columnas que se actualiza solo cada 20 s + filtros avanzados + comunidad y actividad |
| `/api/dashboard` | JSON con todos los tokens enriquecidos (cache 20 s + stale-while-revalidate). Lo consulta el navegador para refrescar |
| `/token/[address]?chain=` | Análisis: mercado, holders, riesgo, tesis, botón de comunidad |
| `/comunidad` | Comunidad General: canales General · Señales · Rugs · Nuevas |
| `/comunidad/[chain]/[address]` | Comunidad del token: Chat y Posts |
| `/actividad` | Feed en vivo (Todo / Siguiendo) |
| `/perfil/[usuario]` | Perfil, seguir, wallets seguidas (privadas), tesis |
| `/ranking` | 4 rankings de memecoins: más sonadas, nuevas con FOMO, más volumen, clásicas (se renueva cada hora) |
| `/predicciones` | Apuesta cuánto va a perdurar una memecoin; ranking de los que más aciertan por categoría |
| `/wallets` | Wallets que aparecen en varias memecoins calientes, más guardadas, y tus wallets (agrega las tuyas) |
| `/privacidad` | Política de privacidad y publicidad (la pide AdSense) |
| `/login` | Google, código al correo, contraseña o wallet (Solana / EVM) |
| `/admin/reportes` | Cola de moderación (admins y mods) |

## Dashboard y filtros
- `src/lib/filters.ts` es la **única fuente** de los umbrales por columna (edad, liquidez, MC, volumen, top 10).
  Cambia ahí los números y se ajustan columnas y panel. Un token aparece en una sola columna
  (prioridad Migrando > Con tracción > Recién lanzadas).
- Top 10 de holders (RugCheck, solo Solana) es **preferencia**: ordena primero los que cumplen (<40 % tracción,
  <30 % migrando) y se puede volver filtro duro desde el panel. Si el dato no existe, el token no se excluye.
- El servidor devuelve todos los tokens y el **navegador** los reparte en columnas; por eso el panel responde
  al instante. Los filtros del usuario se guardan en `localStorage`.
- Las memecoins nuevas entran solas: el cliente consulta `/api/dashboard` cada 20 s (pausa con la pestaña oculta)
  y marca con “Nuevo” las que aparecen.
- La barra de búsqueda se vacía al enviar.

## Cómo funciona lo social
- **Lectura pública, escritura con cuenta.** Todo se protege con RLS en Postgres, no en el frontend.
- **Comunidades de token**: se crean al primer "Unirse". Un Server Action valida el token contra DexScreener y
  llama a la RPC `join_token_community` con `service_role`, así nadie inventa tokens ni metadatos. Los **3
  primeros miembros** son moderadores.
- **Chat**: Supabase Realtime (`postgres_changes`) sobre `messages` y `reactions`. Respuestas, reacciones
  (🚀🔥💀🐸👀💎), imágenes (≤3 MB al bucket `chat-images`), contratos y `$TICKER` se vuelven links.
- **Moderación**: reportar (spam / scam / acoso / otro); autor y mods borran (soft delete, el texto nunca se
  edita); anti-spam de 6 mensajes / 15 s por usuario en un trigger.
- **Actividad**: triggers de Postgres registran tesis y comunidades nuevas en `activity_events`.
- **Wallets seguidas**: botón "Seguir" en cada holder del top 10 y gestor en tu perfil.

## Estructura
```
supabase/migrations/0001_init.sql   schema + RLS + triggers + realtime + storage
src/app/                            rutas (comunidad, actividad, perfil, login, admin, token…)
src/app/actions/community.ts        Server Actions: unirse, salir, publicar tesis
src/components/community/           ChatRoom (realtime), JoinCommunityButton, parts
src/components/{auth,profile,activity,admin,token,dashboard}/
src/lib/supabase/                   clientes: browser, server (cookies), público (ISR), admin
src/lib/services/                   dexscreener, geckoterminal, rugcheck, token, dashboard, community
src/lib/{risk,classify,activity}.ts heurísticas de riesgo / categoría / "fantasma"
src/middleware.ts                   refresca la sesión de Supabase
```

## Notas
- Cache en memoria (`lib/cache.ts`) + `fetch` revalidate. En serverless es por instancia: para producción usa
  Upstash/Netlify Blobs. Límites aprox.: DexScreener 300 req/min, GeckoTerminal ~30/min.
- Esto no es asesoría financiera. El score de riesgo es heurístico.
- Deploy en Netlify: `netlify.toml` ya está listo; añade las variables de `.env.example` en el panel.
- El chat embebido de Discord de la versión anterior se reemplazó por el chat nativo.

## $LATAM, boosts y notificaciones (fase 2)
Token interno de la plataforma. **El balance nunca lo toca el navegador**: solo triggers y RPCs `security definer` en Postgres.

| Acción | $LATAM | Dónde ocurre |
|---|---|---|
| Crear tu cuenta | +20 | trigger `profile_welcome` |
| Publicar una tesis | +15 (máx. 5 premiadas/día) | trigger `thesis_rewards` |
| Crear la comunidad de un token | +50 (máx. 3/día) | RPC `join_token_community` |
| Recibir una reacción | +1 (máx. 30/día, no a ti mismo) | trigger `reaction_rewards` |
| Boost a un token | −10 por hora (10–500) | RPC `boost_token` |
| Destacar tu tesis 24 h | −20 | RPC `feature_thesis` |

- Montos y topes: `supabase/migrations/0002_latam.sql` (y `src/lib/latam.ts` para mostrarlos en la UI; mantén ambos iguales).
- Boosts: la vista `active_boosts` suma los boosts vigentes. El dashboard sube esos tokens al inicio de su columna, los marca con "Boost" y los incluye aunque no estén en tendencia (siguen sujetos a los filtros de la columna).
- Notificaciones (`notifications`): te siguen, reaccionan a tu mensaje o alguien que sigues publica una tesis. Campana en el header, en vivo por Realtime.
- Seguir personas: botón en perfiles y en la sección "Gente en {TOKEN}" de cada token. Quien entra con wallet y está en el top de holders sale como "Holder verificado".
- Login: wallet (Solana/EVM), enlace mágico y correo + contraseña. En **Authentication → Providers → Email** decide si exiges confirmar el correo.
- Darte $LATAM para probar: `select public.award_points((select id from public.profiles where username='tu_usuario'), 500, 'invitacion', null);`


## Fase 3 (esta versión)

### Dominio y marca
- Marca madre: **Veltrix Colombia** (`veltrixcolombia.com`). Esta plataforma: **Veltrix Coin**, pensada como subdominio
  (`memecoin.veltrixcolombia.com`). Todo sale de `src/lib/config.ts` y de dos variables: `NEXT_PUBLIC_SITE_URL`
  y `NEXT_PUBLIC_PARENT_URL`. **Si cambias de dominio solo cambias esas variables en el hosting** y vuelves a desplegar
  (y en Supabase actualizas Site URL y Redirect URLs).
- Subdominio: en el DNS de `veltrixcolombia.com` crea un `CNAME` `memecoin` → el host que te dé tu hosting.

### Anuncios (Google AdSense)
- El script de AdSense se carga **una sola vez** en `src/app/layout.tsx` (con `next/script`, después de que la página ya es
  interactiva, así no frena nada). `public/ads.txt` ya tiene tu publisher ID.
- Espacios (`<AdSlot slot="..."/>`): `home` (entre el dashboard y la comunidad), `sidebar` (lateral de la home),
  `token` (página del token, después de la acción principal), `ranking` (ranking, predicciones y wallets, entre secciones).
  Nunca tapan botones, tarjetas ni el chat y reservan su alto para no mover el contenido.
- **Falta un paso tuyo:** en AdSense crea 4 bloques de anuncio (Anuncios → Por unidad de anuncio → Display adaptable) y pon sus
  IDs en `NEXT_PUBLIC_AD_SLOT_HOME`, `_SIDEBAR`, `_TOKEN`, `_RANKING`. Sin ID, ese espacio no se muestra. También puedes activar
  "Anuncios automáticos" en el panel de AdSense.
- AdSense exige política de privacidad: ya está en `/privacidad` y enlazada en el pie.

### Velocidad en tiempo real
- Cache con *stale-while-revalidate* (`lib/cache.ts`): el usuario recibe al instante el último dato y se recalcula en segundo plano.
- Las fuentes externas tienen tiempo límite individual: una API lenta ya no frena a las demás.
- RugCheck (lo más lento) ya no bloquea la respuesta: el top 10 se completa solo en los refrescos siguientes.
- El navegador pide dashboard y boosts en paralelo y refresca cada 20 s.
- Más candidatos: pools con más volumen de Solana y Base (si no, "Migrando" casi nunca tenía datos con filtros altos).

### Filtros
- El panel ahora edita un borrador y tiene el botón **Buscar · N resultados** (fijo abajo). Muestra cuántos resultados da cada columna
  antes de aplicar y avisa si no sale ninguno.

### Login
- **Google**, **código al correo** (recomendado: sin contraseña), contraseña y wallet. Configuración en Supabase:
  1. *Authentication → Providers → Google*: activa y pega el Client ID/Secret de Google Cloud (OAuth, tipo "Web"). En Google Cloud
     añade como redirect URI la que te muestra Supabase (`https://<proyecto>.supabase.co/auth/v1/callback`).
  2. *Authentication → Email Templates → Magic Link* (y *Confirm signup*): incluye `{{ .Token }}` en el cuerpo para que llegue el código,
     por ejemplo: `Tu código de Veltrix Coin: {{ .Token }}`.
  3. *Authentication → Providers → Email → Email OTP Length*: 6 (o el número que prefieras; la app acepta de 6 a 10).
  4. **Correo propio (SMTP):** el correo integrado de Supabase está limitado a unas pocas por hora y es solo para pruebas.
     Antes de lanzar configura SMTP propio (Resend, Brevo, Gmail SMTP…) en *Project Settings → Authentication → SMTP*.

### Recompensas $LATAM (más bajas)
Migración `0003_predicciones.sql`: bienvenida **5** (antes 20), tesis **3** (3/día), comunidad **10** (2/día), reacción **1** (10/día).

### Predicciones y ranking de aciertos
- Migración `supabase/migrations/0003_predicciones.sql` (ejecútala después de 0001 y 0002).
- Predices que una memecoin seguirá **viva** (o **muerta**) en 1 semana / 1 mes / 3 meses / 6 meses, por categoría (general, IA, animales,
  celebridades). Premio al acertar: 2 / 6 / 15 / 30 $LATAM (apostar a que muere paga la mitad). Máx. 5 por día, una por token, solo
  tokens con ≥ $10K de liquidez. "Viva" = liquidez ≥ $5K y volumen 24 h ≥ $1K al vencer.
- Se resuelven solas al abrir `/predicciones`; opcional: un cron diario a `GET /api/cron/predicciones` con `Authorization: Bearer $CRON_SECRET`.
- Los montos/umbrales viven en el SQL y en `src/lib/predictions.ts` (mantén ambos iguales).

### Wallets
- `/wallets`: "Wallets en movimiento" = wallets de Solana entre los mayores holders de **varias** memecoins calientes (sin pools). Guardar con un
  clic y agregar cualquier wallet a mano. **No se muestran ganancias**: no hay una fuente gratuita y verificable de PnL; mostrar "mejores traders"
  inventados sería engañar al usuario.
- Cambio importante: la lista de holders ahora usa la wallet dueña (`owner` de RugCheck) y no la cuenta de token, para que lo que se guarda sea
  una wallet real.
