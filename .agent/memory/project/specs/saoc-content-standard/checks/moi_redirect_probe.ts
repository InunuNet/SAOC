// Contract probe for saoc-content-standard F2 (A-F2-REDIRECT). Calls proxy() directly and exits 1 on
// the first wrong answer. Run from the repo root: node_modules/.bin/tsx <this file>
import { NextRequest } from 'next/server';

import { proxy } from '../../../../../../proxy';

process.env.NEXT_PUBLIC_SAOC_SITE_URL = 'https://saoc.example';
process.env.NEXT_PUBLIC_NOS_SITE_URL = 'https://nos.saoc.example';
process.env.BETA_PASSWORD_WALL_OFF = 'true';
delete process.env.SITE_PUBLIC_LAUNCH;

const NEW_PATH = '/memorandum-of-incorporation';

async function ask(host: string, path: string): Promise<{ status: number; location: string | null }> {
  const request = new NextRequest(`https://${host}${path}`, { headers: { host } });
  const response = await proxy(request);
  return { status: response.status, location: response.headers.get('location') };
}

async function expectRedirect(host: string, path: string, location: string): Promise<void> {
  const got = await ask(host, path);
  if (got.status !== 308 || got.location !== location) {
    console.error(`FAIL ${host}${path}: want 308 ${location}, got ${got.status} ${got.location}`);
    process.exit(1);
  }
}

async function expectNoRedirect(host: string, path: string): Promise<void> {
  const got = await ask(host, path);
  if (got.status >= 300 && got.status < 400) {
    console.error(`FAIL ${host}${path}: must be served, got ${got.status} ${got.location}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  await expectRedirect('saoc.example', '/constitution', `https://saoc.example${NEW_PATH}`);
  await expectRedirect('saoc.example', '/constitution?a=1', `https://saoc.example${NEW_PATH}?a=1`);
  await expectNoRedirect('saoc.example', NEW_PATH);
  // The NOS host hands SAOC-only paths over in ONE hop, straight to the new path.
  await expectRedirect('nos.saoc.example', '/constitution', `https://saoc.example${NEW_PATH}`);
  await expectRedirect('nos.saoc.example', NEW_PATH, `https://saoc.example${NEW_PATH}`);
  console.log('moi redirect probe: ok');
}

main();
