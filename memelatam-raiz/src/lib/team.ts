/**
 * "¿Quién está detrás?" — veredicto sobre la autenticidad de un token. Código puro.
 * Veltrix NO puede confirmar identidades reales: solo reúne señales públicas y verificables (cuenta de X, enlace entre
 * el perfil y el sitio, si la cuenta oficial publicó este contrato, wallet del creador y tokens con el mismo nombre).
 */
export type TeamVerdict = 'verificado' | 'parcial' | 'sin_equipo' | 'posible_imitacion';
export type NoteTone = 'good' | 'warn' | 'bad' | 'info';

export interface Lookalike {
  chain: string;
  address: string;
  symbol: string;
  name: string;
  liquidityUsd: number;
  ageDays: number | null;
  hasSocials: boolean;
}

export interface TeamReport {
  verdict: TeamVerdict;
  title: string;
  summary: string;
  x: {
    handle: string;
    isTweetLink: boolean;
    /** true = la cuenta existe; false = no existe o está suspendida; null = no se pudo consultar */
    found: boolean | null;
    name: string | null;
    followers: number | null;
    createdAt: string | null;
    ageDays: number | null;
    verified: boolean;
    bio: string | null;
    /** true = la cuenta publicó este contrato; false = no encontramos tweets suyos con él; null = no se pudo consultar */
    mentionsContract: boolean | null;
    websiteMatch: boolean | null;
  } | null;
  website: string | null;
  creator: { address: string; holdingPct: number | null } | null;
  lookalikes: Lookalike[];
  thisRank: { byLiquidity: number; byAge: number; total: number } | null;
  notes: { text: string; tone: NoteTone }[];
  /** false si falta la key de twitterapi.io: la parte de X no se pudo verificar */
  xAvailable: boolean;
  generatedAt: number;
}

export interface VerdictInput {
  hasWebsite: boolean;
  x: TeamReport['x'];
  xAvailable: boolean;
  creator: TeamReport['creator'];
  lookalikes: Lookalike[];
  thisLiquidity: number;
  thisAgeDays: number | null;
}

export function buildVerdict(i: VerdictInput): Pick<TeamReport, 'verdict' | 'title' | 'summary' | 'notes'> {
  const notes: TeamReport['notes'] = [];
  const x = i.x;

  // Un token más viejo y con bastante más liquidez que se llama igual casi siempre es el original.
  const stronger = i.lookalikes.filter((l) => l.liquidityUsd >= Math.max(5_000, i.thisLiquidity * 2) && (l.ageDays ?? 0) >= (i.thisAgeDays ?? 0) + 1);
  const imitation = stronger.length > 0 && x?.mentionsContract !== true;

  if (x) {
    if (x.found === false) notes.push({ text: `La cuenta @${x.handle} no existe o está suspendida.`, tone: 'bad' });
    if (x.found) {
      const age = x.ageDays;
      if (age !== null && age < 30) notes.push({ text: `La cuenta @${x.handle} es muy nueva (creada hace ${age} días).`, tone: 'warn' });
      else if (age !== null) notes.push({ text: `La cuenta @${x.handle} tiene ${age >= 365 ? `${Math.floor(age / 365)} año(s)` : `${age} días`} y ${x.followers?.toLocaleString('en-US') ?? '?'} seguidores.`, tone: age >= 180 && (x.followers ?? 0) >= 1_000 ? 'good' : 'info' });
      if (x.verified) notes.push({ text: 'La cuenta tiene la marca de verificación de X (de pago: indica que alguien pagó, no que sea oficial).', tone: 'info' });
    }
    if (x.mentionsContract === true) notes.push({ text: 'La cuenta de X publicó este contrato: es la señal más fuerte de que está ligada al token.', tone: 'good' });
    else if (x.mentionsContract === false) notes.push({ text: `No encontramos tweets de @${x.handle} con este contrato. Puede que no lo haya publicado o que la búsqueda no lo muestre.`, tone: 'warn' });
    if (x.websiteMatch === true) notes.push({ text: 'El perfil de X enlaza al mismo sitio web que el token.', tone: 'good' });
    else if (x.websiteMatch === false) notes.push({ text: 'El perfil de X y el token apuntan a sitios web distintos.', tone: 'warn' });
    if (x.isTweetLink) notes.push({ text: 'El enlace de X del token apunta a un tweet suelto, no a un perfil.', tone: 'info' });
  } else {
    notes.push({ text: 'El token no tiene cuenta de X registrada.', tone: i.hasWebsite ? 'warn' : 'bad' });
  }
  if (!i.hasWebsite) notes.push({ text: 'El token no tiene sitio web registrado.', tone: 'warn' });
  if (x && !i.xAvailable) notes.push({ text: 'No pudimos verificar la cuenta de X ahora mismo (falta configurar el proveedor de datos).', tone: 'info' });

  if (i.creator) {
    const pct = i.creator.holdingPct;
    if (pct !== null && pct >= 10) notes.push({ text: `La wallet creadora todavía tiene ${pct.toFixed(1)}% del supply: si vende, el precio cae.`, tone: 'warn' });
    else if (pct !== null) notes.push({ text: `La wallet creadora tiene ${pct.toFixed(1)}% del supply.`, tone: 'info' });
  }

  if (i.lookalikes.length > 0) {
    notes.push({ text: `Hay ${i.lookalikes.length} token(s) con el mismo nombre o símbolo en estas redes.`, tone: imitation ? 'bad' : 'warn' });
    if (imitation) {
      const top = stronger.reduce((a, b) => (b.liquidityUsd > a.liquidityUsd ? b : a));
      notes.push({ text: `${top.symbol} (${top.name}) es más antiguo y tiene mucha más liquidez. Este token podría ser una imitación.`, tone: 'bad' });
    }
  }

  let verdict: TeamVerdict;
  if (imitation) verdict = 'posible_imitacion';
  else if (x?.mentionsContract === true && (x.ageDays ?? 0) >= 60) verdict = 'verificado';
  else if (x || i.hasWebsite) verdict = 'parcial';
  else verdict = 'sin_equipo';

  const copy: Record<TeamVerdict, { title: string; summary: string }> = {
    verificado: { title: 'Equipo con señales verificables', summary: 'La cuenta de X del proyecto es antigua y publicó este contrato. No garantiza que el token sea seguro, pero sí que alguien visible respalda este contrato.' },
    parcial: { title: 'Equipo sin verificar', summary: 'Tiene redes o sitio web, pero no pudimos comprobar que sean los oficiales de este contrato. Verifica en el perfil de X que publique esta dirección.' },
    sin_equipo: { title: 'Sin equipo visible', summary: 'No hay cuenta de X ni sitio web registrados. No hay a quién pedirle explicaciones: es una señal de riesgo.' },
    posible_imitacion: { title: 'Posible imitación', summary: 'Existe un token con el mismo nombre, más antiguo y con mucha más liquidez, y este contrato no está respaldado por una cuenta oficial. Revisa cuál es el contrato real antes de comprar.' },
  };
  return { verdict, ...copy[verdict], notes };
}
