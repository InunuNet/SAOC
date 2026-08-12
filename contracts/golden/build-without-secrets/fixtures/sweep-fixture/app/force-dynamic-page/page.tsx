import { doAdminThing } from '@/lib/admin-thing';
export const dynamic = 'force-dynamic';
export default async function Page() {
  doAdminThing();
  return null;
}
