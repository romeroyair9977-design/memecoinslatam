# MemeLatam (MVP)

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
| `/` | Ticker + dashboard de 3 columnas que se actualiza solo cada 30 s + filtros avanzados + comunidad y actividad |
| `/api/dashboard` | JSON con todos los tokens enriquecidos (cache 30 s). Lo consulta el navegador para refrescar |
| `/token/[address]?chain=` | Análisis: mercado, holders, riesgo, tesis, botón de comunidad |
| `/comunidad` | Comunidad General: canales General · Señales · Rugs · Nuevas |
| `/comunidad/[chain]/[address]` | Comunidad del token: Chat y Posts |
| `/actividad` | Feed en vivo (Todo / Siguiendo) |
| `/perfil/[usuario]` | Perfil, seguir, wallets seguidas (privadas), tesis |
| `/login` | Wallet (Solana / EVM) o enlace por correo |
| `/admin/reportes` | Cola de moderación (admins y mods) |

## Dashboard y filtros
- `src/lib/filters.ts` es la **única fuente** de los umbrales por columna (edad, liquidez, MC, volumen, top 10).
  Cambia ahí los números y se ajustan columnas y panel. Un token aparece en una sola columna
  (prioridad Migrando > Con tracción > Recién lanzadas).
- Top 10 de holders (RugCheck, solo Solana) es **preferencia**: ordena primero los que cumplen (<40 % tracción,
  <30 % migrando) y se puede volver filtro duro desde el panel. Si el dato no existe, el token no se excluye.
- El servidor devuelve todos los tokens y el **navegador** los reparte en columnas; por eso el panel responde
  al instante. Los filtros del usuario se guardan en `localStorage`.
- Las memecoins nuevas entran solas: el cliente consulta `/api/dashboard` cada 30 s (pausa con la pestaña oculta)
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

---

# Fase 3 — guía de configuración

## 1. Base de datos (Supabase → SQL Editor, en este orden)
Ya corriste `0001` y `0002`. Ahora ejecuta:
1. `supabase/migrations/0003_predicciones.sql` — premios de $LATAM más bajos, predicciones de permanencia y ranking.
2. `supabase/migrations/0004_tendencias_x.sql` — tablas y funciones de "Tendencias en X".

## 2. Variables de entorno (Netlify → Project configuration → Environment variables)
| Variable | Para qué |
|---|---|
| `TWITTERAPI_IO_KEY` | Key de twitterapi.io. **Solo servidor.** Regenérala si la compartiste en algún chat |
| `CRON_SECRET` | Cadena larga y aleatoria que protege los endpoints de cron |
| `X_MAX_PAGES` | `1` (recomendado). Páginas por consulta en cada escaneo |
| `DEEPL_API_KEY` | Opcional. Traduce tweets al español (DeepL gratis). Sin ella se ofrece enlace a Google Traductor |
| `NEXT_PUBLIC_ADSENSE_SLOT_HOME` / `_TOKEN` / `_RANKING` | IDs de bloque de AdSense (ver punto 4) |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Opcional: correo de contacto en la política de privacidad |
| `NEXT_PUBLIC_SITE_URL` | Tu URL final (p. ej. `https://memecoin.veltrixcolombia.com`) |

> Las variables `NEXT_PUBLIC_*` se incorporan **en el build**: después de cambiarlas hay que redesplegar.

## 3. Crons gratuitos (cron-job.org u otro)
Crea dos tareas HTTP GET con la cabecera `Authorization: Bearer TU_CRON_SECRET`:

| URL | Frecuencia | Qué hace |
|---|---|---|
| `https://TU-DOMINIO/api/cron/x-scan` | cada 30 min | Guarda las menciones nuevas de X |
| `https://TU-DOMINIO/api/cron/resolve-predictions` | 1 vez al día | Resuelve predicciones vencidas y paga $LATAM |

**Costo de X:** twitterapi.io cobra ≈ 0,00015 USD por tweet devuelto. Con 3 consultas × 1 página (~20 tweets) son ≤ 60 tweets por corrida ≈ 0,009 USD; cada 30 min ≈ 0,43 USD/día (≈ 13 USD/mes) como máximo. La respuesta del cron incluye `estimatedCostUsd` para que lo vigiles. Las consultas se editan en `src/lib/xmentions.ts` (`X_QUERIES`).

**Límites honestos:** es una *muestra* de menciones (consultas con `min_faves`), no el 100 % de X. Algunos proveedores reportan que la paginación por cursor falla a veces; por eso el diseño usa ventanas de tiempo (`since_time`/`until_time`) y una sola página por consulta.

## 4. Anuncios (Google AdSense)
1. En AdSense agrega tu sitio y espera la aprobación (el script y `public/ads.txt` ya están puestos; la política de privacidad está en `/privacidad`).
2. Anuncios → **Por bloque de anuncios** → crea 3 bloques de *display* responsivo: Home, Token y Ranking. Copia el número de cada uno (`data-ad-slot`) a las variables `NEXT_PUBLIC_ADSENSE_SLOT_*`.
3. Ubicaciones (a propósito pocas): debajo de las columnas del dashboard, entre los traders y el análisis en la página de token, y al final del ranking. **No hay anuncios** en chats, login ni cerca de botones de acción.
4. Si prefieres que Google los coloque solo, activa *Anuncios automáticos* en AdSense; conviven con estos bloques.
5. Si tienes visitantes del Espacio Económico Europeo o Reino Unido necesitas además un banner de consentimiento (CMP) certificado por Google.

## 5. Login con código por correo y con Google
- **Código por correo:** en Supabase → Authentication → **Email Templates**, edita las plantillas **Magic Link** *y* **Confirm signup** para incluir el código: `Tu código es: {{ .Token }}`. (Las cuentas nuevas reciben la plantilla *Confirm signup*, las existentes la *Magic Link*.)
- **Correos que sí llegan:** el servidor de correo integrado de Supabase está pensado para pruebas y tiene límites muy bajos. Para producción configura SMTP propio en Authentication → SMTP Settings (Resend, Brevo, etc.).
- **Google:** Google Cloud Console → Credenciales → ID de cliente OAuth (aplicación web). En *URI de redireccionamiento autorizados* pon `https://TU-PROYECTO.supabase.co/auth/v1/callback`. Pega Client ID y Secret en Supabase → Authentication → Providers → **Google** y actívalo.

## 6. Subdominio `memecoin.veltrixcolombia.com`
1. Netlify → Domain management → *Add domain alias* → `memecoin.veltrixcolombia.com`.
2. Namecheap → Advanced DNS → CNAME, Host `memecoin`, Value `memelatam-raiz.netlify.app` (sin `https://` ni `/`).
3. Cambia `NEXT_PUBLIC_SITE_URL` y las *Redirect URLs* de Supabase al nuevo dominio. Redespliega.
4. Si más adelante cambias de dominio principal, la marca madre se edita en `src/lib/config.ts` (`PARENT`).

## 7. Qué cambió en velocidad
- Un endpoint liviano (`/api/prices`) refresca precios y números de las cards cada 6 s; la lista completa, cada 20 s.
- La página de token se actualiza cada 4 s y su gráfico de velas se mueve con el precio en vivo.
- El middleware ya no consulta a Supabase en cada visita de usuarios sin sesión, ni en las APIs de datos.
- Cada fuente externa tiene tope de 4 s: una lenta ya no frena todo el dashboard.

---

# Fase 3c — Mercado (Ranking, Ballenas, Potencial) y menú

## Menú (4 entradas en vez de 8)
**Tendencias en X · Dashboard · Mercado ▾ (Ranking de memecoins, Ballenas, Potencial) · Comunidad ▾ (Chat y comunidades, Predictores, Actividad)**.
La antigua ruta `/ranking` redirige a `/predictores`. Se edita en `src/components/layout/MainNav.tsx`.

## Ranking de memecoins por ciclos — `/scan`
Ciclo 1: 1 a 7 días · Ciclo 2: 7 a 30 días · Ciclo 3: 30+ días (edad del pool principal, solo si sigue viva: liquidez ≥ 5.000 USD y volumen ≥ 1.000 USD/día). En los ciclos 1 y 2 cada token muestra su **opción de llegar al siguiente ciclo** (alta/media/baja) con los motivos. Definiciones y pesos: `src/lib/cycles.ts`.

## Ballenas — `/ballenas` y sección "Si venden las ballenas" en cada token
Top 5 ballenas con su valor en USD y qué pasa con el precio si venden la #1, las 2, 3 o 5 primeras, con el modelo de pool de producto constante de `src/lib/whales.ts` (caída = 1 − 1/k², k = 1 + 2V/L). **Solo Solana** (RugCheck). "Ballenas ahora" = tokens de 7+ días; "lanzamientos recientes" = menos de 7 días.

## Potencial x10 / x100 / x1000 — `/potencial` y tarjeta en cada token
Cada token muestra el market cap necesario y la compra neta aproximada para cada múltiplo. Además un cron propone **llamados de Veltrix** con reglas transparentes (`src/lib/potential.ts`: x1000 solo con nota ≥ 80 y MC ≤ 500 K; x100 nota ≥ 65 y MC ≤ 5 M; x10 nota ≥ 52 y MC ≤ 50 M), máximo 2 nuevos por nivel por corrida. Cada llamado se marca **cumplido** (el precio llegó al múltiplo), **fallado** (venció el plazo —30/90/180 días— o el token murió) y el historial es público.

### Instalar
1. Supabase → SQL Editor: ejecuta `supabase/migrations/0005_potencial.sql`.
2. Cron nuevo (mismo `CRON_SECRET`), cada 30 min:
   `GET https://TU-DOMINIO/api/cron/potencial`  con  `Authorization: Bearer TU_CRON_SECRET`.
3. Ballenas y Ranking no necesitan configuración ni base de datos.

### Límites honestos
- Los llamados son escenarios, no predicciones: la mayoría de las memecoins pierde valor y un x1000 es rarísimo.
- El pico se mide en cada corrida del cron; un salto más corto que el intervalo puede no registrarse.
- Ballenas: RugCheck no cubre EVM; el valor usa market cap × % del supply (ignora tokens bloqueados/quemados).

---

# Fase 3d — Contrato visible, "¿Quién está detrás?" y Tendencias en X que se actualizan solas

## Contrato visible
Cada token muestra su contrato completo bajo el nombre, con botones para copiar y abrir en el explorador (`ContractLine`).

## ¿Quién está detrás? (en cada token)
Veltrix **no puede confirmar identidades reales**; reúne señales públicas y verificables y da un veredicto:
- **Cuenta de X** del token (de DexScreener/GeckoTerminal): existe, antigüedad, seguidores, marca de verificación.
- **¿La cuenta publicó este contrato?** Búsqueda `from:@cuenta "contrato"` (la señal más fuerte contra imitaciones).
- **¿El perfil enlaza al mismo sitio web que el token?**
- **Wallet creadora** y cuánto del supply aún tiene (RugCheck, Solana).
- **Tokens con el mismo nombre o símbolo** en todas las redes, con liquidez, edad y si tienen redes → detecta imitaciones (p. ej. otro "FLOAT" que no es el equipo real).
- Veredictos: *Equipo con señales verificables · Equipo sin verificar · Sin equipo visible · Posible imitación* (si existe un token igual, más viejo y con ≥ 2× la liquidez, y este contrato no está respaldado por la cuenta de X).

Costo: ≈ 0,0003 USD por informe (un perfil + una búsqueda), con cache de 6 h por token. Sin `TWITTERAPI_IO_KEY` el informe sigue funcionando, solo sin la parte de X.

## Tendencias en X: qué cambió
- **Se actualiza sola.** Si los datos tienen más de 30 min, la página pide una actualización (`POST /api/x-trends/refresh`). Un candado en Postgres permite **un escaneo cada 30 min** (`X_REFRESH_MIN`) para todos los visitantes juntos. El cron externo pasa a ser opcional.
- **Ventanas cortas.** La búsqueda de twitterapi.io devuelve ~7–20 tweets por consulta y su paginación está rota, así que cada escaneo parte el tiempo en ventanas de 15 min (`X_WINDOW_MIN`, hasta `X_MAX_WINDOWS` = 3).
- **Tope diario de gasto:** `X_DAILY_BUDGET_USD` (0,5 por defecto). Un escaneo típico cuesta ≈ 0,01 USD: a ritmo completo son ≈ 0,4 USD/día (≈ 13 USD/mes). Con el bono de 1 USD de twitterapi.io alcanza para unos 2 a 3 días a ese ritmo; para estirarlo sube `X_REFRESH_MIN` a 60 (≈ 0,2 USD/día).
- **Diagnóstico en una URL:** `https://TU-DOMINIO/api/x-trends/status` muestra qué falta (key, service role, migración, último error) sin revelar secretos.

### Instalar
1. Supabase → SQL Editor: ejecuta `supabase/migrations/0006_x_scan_robusto.sql`.
2. Netlify → variables: `TWITTERAPI_IO_KEY` (**regenérala si la compartiste**), `SUPABASE_SERVICE_ROLE_KEY` y, si usas cron, `CRON_SECRET`. Después redespliega: las variables nuevas no se leen hasta el siguiente deploy.
3. Abre `/api/x-trends/status` y confirma que `hints` esté vacío.

### Qué significa cada error del escaneo
| Señal | Causa |
|---|---|
| `Aún no se ha escaneado X` y `/status` sin errores | Nadie ha abierto la página ni llamado al cron todavía |
| `twitterKey: false` en `/status` | Falta `TWITTERAPI_IO_KEY` (o no se redesplegó) |
| `lastError: HTTP 401` o `403` | Key inválida (¿la regeneraste y no actualizaste Netlify?) |
| `lastError: HTTP 402` | Sin saldo en twitterapi.io |
| `lastError: HTTP 429` | Demasiadas consultas: con saldo < 1.000 créditos el límite es 1 consulta cada 5 s |
| Cron responde `401` | El secreto del cron no coincide con `CRON_SECRET` |
| Cron responde `500` con "Falta CRON_SECRET" | La variable no existe en Netlify |

---

# Fase 3e — FOMO en vivo, niveles e impulso, "Mi entrada", búsqueda por nombre y Potencial v2

## Qué hay de nuevo
- **FOMO en vivo (`/fomo`, menú Mercado):** ranking que se actualiza cada 10 s con las memecoins donde más rápido entran compras. Mide compras por minuto en los últimos 5 min, aceleración frente al resto de la hora, % de compras y volumen. Red ancha: dashboard + pools nuevos, en tendencia y con más transacciones (2 páginas de cada uno, Solana y Base). Filtros: Solana, Base, agentes de IA, con cuenta de X, nuevas. Orden: «Más FOMO» o «Mejor calidad» (FOMO + equipo visible + liquidez). Fórmula y límites: `src/lib/momentum.ts`.
- **Niveles e impulso (en cada token):** desde el primer dato de precio, en niveles de 10 en 10 (x10, x100, x1000, x10000): «salió en» (aprox.), pico, caída desde el pico y la fecha de cada nivel. Estado de impulso (*Acelerando / Sostenido / Enfriándose / Colapsando*) con un mensaje y sus motivos. Si el token tiene mint o freeze activos o el top 10 pasa de 60 %, **no** se anima a seguir subiendo.
- **Mi entrada:** sin cuenta, en tu navegador: pones tu market cap (o precio) de entrada y cuánto invertiste y calcula tu múltiplo, el siguiente nivel y lo que realmente te pagaría el pool si vendes ahora (con deslizamiento).
- **Búsqueda por nombre o símbolo:** la barra acepta «TERESA»; abre `/buscar` con los tokens que coinciden, ordenados por liquidez, para elegir el correcto (hay imitaciones: revisa «¿Quién está detrás?»).
- **Potencial v2:** los llamados se publican **solos** (sin cron externo) desde el ranking de FOMO: moneda de menos de 72 h, liquidez ≥ 8 K, FOMO ≥ 55, mayoría de compras y, en Solana, sin mint/freeze y top 10 ≤ 60 % (sin datos de seguridad no se publica). Un mismo token abre x10 (MC ≤ 1 M), x100 (MC ≤ 100 K) y x1000 (MC ≤ 25 K) desde la misma entrada. Plazos 7 / 30 / 90 días. Se revisan por precio y por velas de 1 h.
- **Tareas automáticas:** al abrir el sitio se dispara (máx. 1 vez cada 10 min para todos) la tarea de Potencial y (1 vez por hora) la resolución de predicciones. El cron externo pasa a ser opcional.

## Instalar
1. Supabase → SQL Editor: ejecuta `supabase/migrations/0007_tareas_y_llamados.sql`.
2. Sube los archivos y deja un solo deploy.
3. Abre la home una vez: eso dispara la primera corrida de Potencial. Los llamados aparecen en `/potencial` cuando haya monedas que cumplan todos los criterios.

## Límites honestos
- La ventana más corta de la fuente es de 5 minutos (no hay datos «por segundo») y se cuentan **compras**, no personas distintas.
- «Salió en» se estima con la primera vela diaria disponible; para tokens que migraron de pump.fun puede no ser el precio de lanzamiento.
- Los mensajes de impulso son **señales, no órdenes**: una señal de salida llega cuando el precio ya empezó a bajar.
- «Posible IA» se detecta por palabras en el nombre o la descripción: puede fallar.
- Las fuentes son gratuitas (DexScreener y GeckoTerminal): cobertura amplia, no total.
