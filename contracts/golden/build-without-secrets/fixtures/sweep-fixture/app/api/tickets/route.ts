import { doAdminThing } from '@/lib/admin-thing';
export async function GET() { doAdminThing(); return new Response('ok'); }
