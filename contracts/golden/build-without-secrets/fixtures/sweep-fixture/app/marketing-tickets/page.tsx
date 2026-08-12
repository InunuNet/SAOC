import { doAdminThing } from '@/lib/admin-thing';
export const revalidate = 60;
export default async function Page() {
  doAdminThing();
  return null;
}
