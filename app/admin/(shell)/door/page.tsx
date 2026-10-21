import { DoorScannerClient } from '@/components/admin/DoorScannerClient';
import { fetchCheckedInCount } from '@/lib/admin-dashboard';

// Server Component wrapper for the door check-in scanner. The session gate lives in
// app/admin/(shell)/door/layout.tsx and the shell comes from app/admin/(shell)/layout.tsx. The
// "Checked in" counter is read here at request time; a failed count hides it rather than
// blocking the scanner. The scanner's own camera lifecycle and manual-entry fallback live in
// components/admin/DoorScannerClient.tsx.
export const dynamic = 'force-dynamic';

export default async function DoorPage() {
  const checkedInCount = await fetchCheckedInCount();
  return <DoorScannerClient initialCheckedInCount={checkedInCount} />;
}
