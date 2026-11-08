import { redirect } from 'next/navigation';

/** La pestaña ahora se llama Predictores. Este redirect evita enlaces rotos. */
export default function RankingRedirect() {
  redirect('/predictores');
}
