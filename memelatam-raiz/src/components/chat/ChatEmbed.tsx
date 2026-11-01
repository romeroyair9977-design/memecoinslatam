/**
 * Chat global embebido.
 * - Con DISCORD_SERVER_ID + DISCORD_CHANNEL_ID → WidgetBot (chat real; requiere añadir el bot de WidgetBot al server).
 * - Solo con DISCORD_SERVER_ID → widget oficial de Discord (solo muestra miembros + botón de unirse).
 * - Sin nada → instrucciones.
 */
export function ChatEmbed() {
  const server = process.env.NEXT_PUBLIC_DISCORD_SERVER_ID;
  const channel = process.env.NEXT_PUBLIC_DISCORD_CHANNEL_ID;

  const src = server && channel
    ? `https://e.widgetbot.io/channels/${server}/${channel}`
    : server
      ? `https://discord.com/widget?id=${server}&theme=dark`
      : null;

  return (
    <section id="chat" className="scroll-mt-20">
      <h2 className="font-display text-lg font-semibold">Chat de la comunidad</h2>
      <p className="mb-3 text-sm text-muted">Comparte tu tesis, pregunta por un token y avisa de posibles scams.</p>
      {src ? (
        <iframe
          src={src}
          title="Chat de la comunidad en Discord"
          className="h-[520px] w-full rounded-xl border border-line bg-panel"
          loading="lazy"
          allow="clipboard-write"
        />
      ) : (
        <div className="rounded-xl border border-dashed border-line p-6 text-sm text-muted">
          Configura <code className="text-ink">NEXT_PUBLIC_DISCORD_SERVER_ID</code> y{' '}
          <code className="text-ink">NEXT_PUBLIC_DISCORD_CHANNEL_ID</code> en <code className="text-ink">.env.local</code> para mostrar el chat aquí.
        </div>
      )}
    </section>
  );
}
