'use client';

import { AdminError } from '@/components/admin/AdminError';

export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <AdminError {...props} />;
}
