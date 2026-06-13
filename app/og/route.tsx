import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export const runtime = 'edge';

export function GET(request: NextRequest): ImageResponse {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get('title') ?? 'South African Orchid Council';

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          width: '100%',
          height: '100%',
          padding: '60px 72px',
          background: 'linear-gradient(135deg, #1a2e1e 0%, #0f1a11 100%)',
          fontFamily: 'Georgia, serif',
        }}
      >
        {/* Accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '6px',
            background: '#4A7C59',
          }}
        />

        {/* Org name */}
        <div
          style={{
            display: 'flex',
            fontSize: 22,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#4A7C59',
            marginBottom: 24,
            fontFamily: 'Georgia, serif',
          }}
        >
          South African Orchid Council
        </div>

        {/* Page title */}
        <div
          style={{
            display: 'flex',
            fontSize: title.length > 60 ? 42 : 56,
            fontWeight: 700,
            color: '#f5f0e8',
            lineHeight: 1.2,
            maxWidth: 900,
          }}
        >
          {title}
        </div>

        {/* Domain */}
        <div
          style={{
            display: 'flex',
            marginTop: 32,
            fontSize: 18,
            color: '#6b8f75',
          }}
        >
          saoc.co.za
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
