import { readFile } from 'node:fs/promises';

import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

// The National Show's own share card (NOS Design J3): the reversed NOS horizontal lockup top-left
// on the royal ground, the page title below it in Fraunces 300, and the show's address in Karla
// gold bottom-left. SAOC routes keep app/og/route.tsx. satori reads static TTFs only, so the two
// faces are instances cut from the same Fraunces and Karla the pages use (see ./fonts).
const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
const CARD_PADDING = 56;
const LOCKUP_WIDTH = 560;
const LOCKUP_RATIO = 294 / 1200; // supplied file is 1200x294
const TITLE_GAP = 72;
const TITLE_MAX_WIDTH = 1000;
const TITLE_SIZE = 64;
const TITLE_SIZE_LONG = 52;
const LONG_TITLE_LENGTH = 48;
const MAX_TITLE_LENGTH = 120;
const URL_LINE_SIZE = 12;
const FALLBACK_TITLE = 'National Orchid Show';

const ROYAL = '#211A57';
const GOLD = '#F3F2D6';
const GOLD_100 = '#FBFAF0';

const LOCKUP_URL = new URL(
  '../../../../public/images/nos/nos-reversed-horizontal-1200.png',
  import.meta.url
);
const FRAUNCES_URL = new URL('./fonts/Fraunces-Light.ttf', import.meta.url);
const KARLA_URL = new URL('./fonts/Karla-Bold.ttf', import.meta.url);

async function load(url: URL): Promise<Buffer> {
  // Node's fetch cannot read file: URLs; readFile takes the URL and the bundler still traces it.
  return readFile(url);
}

function cleanTitle(raw: string | null): string {
  // Drop control characters and cap the length: the title is drawn, never interpreted.
  const text = (raw ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.slice(0, MAX_TITLE_LENGTH) : FALLBACK_TITLE;
}

export async function GET(request: NextRequest): Promise<ImageResponse> {
  const title = cleanTitle(request.nextUrl.searchParams.get('title'));
  const [lockup, fraunces, karla] = await Promise.all([
    load(LOCKUP_URL),
    load(FRAUNCES_URL),
    load(KARLA_URL),
  ]);
  const lockupSrc = `data:image/png;base64,${Buffer.from(lockup).toString('base64')}`;

  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        padding: CARD_PADDING,
        background: ROYAL,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- satori renders a plain <img> */}
      <img
        src={lockupSrc}
        alt=""
        width={LOCKUP_WIDTH}
        height={Math.round(LOCKUP_WIDTH * LOCKUP_RATIO)}
      />
      <div
        style={{
          display: 'flex',
          marginTop: TITLE_GAP,
          maxWidth: TITLE_MAX_WIDTH,
          fontFamily: 'Fraunces',
          fontWeight: 300,
          fontSize: title.length > LONG_TITLE_LENGTH ? TITLE_SIZE_LONG : TITLE_SIZE,
          lineHeight: 1.12,
          color: GOLD_100,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          left: CARD_PADDING,
          bottom: CARD_PADDING / 2,
          fontFamily: 'Karla',
          fontWeight: 700,
          fontSize: URL_LINE_SIZE,
          letterSpacing: '0.14em',
          color: GOLD,
        }}
      >
        saoc.co.za/national-show
      </div>
    </div>,
    {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      fonts: [
        { name: 'Fraunces', data: fraunces, weight: 300, style: 'normal' },
        { name: 'Karla', data: karla, weight: 700, style: 'normal' },
      ],
    }
  );
}
