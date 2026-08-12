import { cookies } from 'next/headers';
import { doAdminThing } from '@/lib/admin-thing';
export default async function Page() {
  await cookies();
  doAdminThing();
  return null;
}
