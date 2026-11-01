/** Reglas del token interno de la plataforma. Los montos reales los aplica Postgres (supabase/migrations/0002_latam.sql);
 *  estas constantes solo sirven para mostrarlos en la UI. Si cambias uno, cámbialo también en el SQL. */
export const LATAM = {
  symbol: '$LATAM',
  welcome: 20,
  thesis: 15,
  community: 50,
  reaction: 1,
  featureThesisCost: 20,
  /** 10 $LATAM = 1 hora de boost */
  boostPerHour: 10,
} as const;

/** Montos de boost ofrecidos (múltiplos de 10, entre 10 y 500). */
export const BOOST_OPTIONS = [10, 50, 100, 240] as const;
export const boostHours = (amount: number) => amount / LATAM.boostPerHour;

export const formatLatam = (n: number) => `${n.toLocaleString('es')} ${LATAM.symbol}`;

export const POINT_REASONS: Record<string, string> = {
  bienvenida: 'Bienvenida',
  tesis: 'Tesis publicada',
  comunidad_creada: 'Comunidad creada',
  reaccion: 'Reacción recibida',
  invitacion: 'Invitación',
  boost: 'Boost a un token',
  tesis_destacada: 'Tesis destacada',
};
