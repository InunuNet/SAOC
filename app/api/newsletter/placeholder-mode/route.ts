import { NextResponse } from 'next/server';

import { withholdPlaceholderProse } from '@/lib/data/show-pages';

export function GET() {
  return NextResponse.json(
    { showCopyGap: !withholdPlaceholderProse() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
