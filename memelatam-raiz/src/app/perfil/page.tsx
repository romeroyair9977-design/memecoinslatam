import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** /perfil → tu propio perfil (o login si no hay sesión). */
export default async function MyProfileRedirect() {
  const me = await getMe();
  redirect(me ? `/perfil/${me.username}` : '/login?next=/perfil');
}
