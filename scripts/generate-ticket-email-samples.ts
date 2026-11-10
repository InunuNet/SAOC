/**
 * ticket-email-samples (F2/F3) — renders Lee-Ann's per-ticket-type emails and the matching
 * ticket PDFs as sample PDFs for her approval. Run with `pnpm samples:ticket-emails [outDir]`.
 *
 * Output (default samples/ticket-emails/): 00-cover.pdf, email-<key>.pdf x8, ticket-<key>.pdf x8
 * and ticket-emails-combined.pdf (cover first). The emails come from the same builder the live
 * send path uses. Nothing is sent and nothing leaves this machine: the browser is blocked from
 * every request that is not an inline data: URI.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { render } from '@react-email/components';
import { PDFDocument } from 'pdf-lib';
import { chromium, type Browser } from 'playwright';

import { buildTicketTypeEmail } from '@/lib/ticket-type-email';
import { generateBookingRefQrDataUri } from '@/lib/qr';
import { buildTicketPdf } from '@/lib/ticket-pdf';
import { buildOrderEmailFields } from '@/lib/ticket-order-fields';

import { COVER_INTRO, COVER_QUESTIONS, COVER_TITLE } from './ticket-email-sample-cover';
import {
  SAMPLE_PRICE_RAND,
  SAMPLE_EMERGENCY,
  SAMPLE_FIRST_NAME,
  SAMPLE_OPENING_TIMES,
  SAMPLE_ORDERS,
  SAMPLE_QUESTIONS_EMAIL,
  SAMPLE_SHOW_DATES,
  SAMPLE_SHOW_URL,
  SAMPLE_VENUE_NAME,
  type SampleOrder,
} from './ticket-email-sample-fixtures';

const DEFAULT_OUT_DIR = 'samples/ticket-emails';
const EMAIL_IMAGE_DIR = path.join('public', 'images', 'email');
const PAGE_MARGIN = '12mm';
const CONTENT_ID_PREFIX = 'qr-';

const EMAIL_IMAGE_URL = /(src|href)="https?:\/\/[^"]*?\/images\/email\/([^"]+)"/g;
const BODY_OPEN = /<body[^>]*>/;

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function inlineEmailImages(html: string): Promise<string> {
  const files = new Set<string>();
  for (const match of html.matchAll(EMAIL_IMAGE_URL)) files.add(match[2]);
  const dataUris = new Map<string, string>();
  for (const file of files) {
    const bytes = await readFile(path.join(EMAIL_IMAGE_DIR, file));
    dataUris.set(file, `data:image/png;base64,${bytes.toString('base64')}`);
  }
  return html.replace(EMAIL_IMAGE_URL, (_m, attr: string, file: string) => {
    const uri = dataUris.get(file);
    if (!uri) throw new Error(`email image not inlined: ${file}`);
    return `${attr}="${uri}"`;
  });
}

async function renderEmailHtml(order: SampleOrder): Promise<string> {
  const contentId = `${CONTENT_ID_PREFIX}${order.bookingReference}`;
  const fields = buildOrderEmailFields(SAMPLE_PRICE_RAND, order.chosenDay);
  const email = buildTicketTypeEmail({
    key: order.key,
    values: {
      firstName: SAMPLE_FIRST_NAME,
      visitorName: order.visitorName,
      quantity: String(order.quantity),
      bookingReference: order.bookingReference,
      amountPaid: fields.amountPaid,
      paymentStatus: fields.paymentStatus,
      visitDate: fields.visitDate ?? null,
    },
    positions: [
      {
        bookingRef: order.bookingReference,
        attendeeName: order.visitorName,
        ticketTypeTitle: order.title,
        qrContentId: contentId,
      },
    ],
    recoveryUrl: null,
  });
  const qrUri = await generateBookingRefQrDataUri(order.bookingReference);
  const html = (await render(email.react)).replaceAll(`cid:${contentId}`, qrUri);
  const header =
    '<div style="font:600 15px Arial,sans-serif;padding:12px 16px;border-bottom:1px solid #999;' +
    `color:#222">Subject: ${escapeHtml(email.subject)}</div>`;
  return (await inlineEmailImages(html)).replace(BODY_OPEN, (open) => open + header);
}

function renderCoverHtml(): string {
  const questions = COVER_QUESTIONS.map((line) => `<p>${escapeHtml(line)}</p>`).join('');
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><style>' +
    'body{font:15px/1.5 Arial,sans-serif;color:#222;margin:0}' +
    'h1{font-size:26px;color:#211a57;margin:0 0 16px}p{margin:0 0 12px}' +
    `</style></head><body><h1>${escapeHtml(COVER_TITLE)}</h1>` +
    `<p>${escapeHtml(COVER_INTRO)}</p>${questions}</body></html>`
  );
}

async function htmlToPdf(browser: Browser, html: string): Promise<Uint8Array> {
  const page = await browser.newPage();
  try {
    // Offline by construction: only inline data: URIs may load.
    await page.route('**/*', (route) =>
      route.request().url().startsWith('data:') ? route.continue() : route.abort()
    );
    await page.setContent(html, { waitUntil: 'load' });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
    });
  } finally {
    await page.close();
  }
}

function buildSampleTicketPdf(order: SampleOrder): Promise<Uint8Array> {
  return buildTicketPdf({
    orderReference: null,
    positions: [
      {
        bookingRef: order.bookingReference,
        attendeeName: order.visitorName,
        ticketType: order.title,
        slug: order.slug,
        schedule: order.schedule,
      },
    ],
    visit: {
      venueName: SAMPLE_VENUE_NAME,
      venueAddress: null,
      venueParking: null,
      showDates: SAMPLE_SHOW_DATES,
      showUrl: SAMPLE_SHOW_URL,
      emergency: SAMPLE_EMERGENCY,
      onSiteContact: null,
      organiser: null,
      showOffice: null,
      questionsEmail: SAMPLE_QUESTIONS_EMAIL,
      openingTimes: SAMPLE_OPENING_TIMES,
    },
  });
}

async function mergePdfs(parts: readonly Uint8Array[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  for (const part of parts) {
    const doc = await PDFDocument.load(part);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }
  return merged.save();
}

async function main(): Promise<void> {
  const outDir = process.argv[2] ?? DEFAULT_OUT_DIR;
  await mkdir(outDir, { recursive: true });
  const write = (name: string, bytes: Uint8Array): Promise<void> =>
    writeFile(path.join(outDir, name), bytes);

  const browser = await chromium.launch();
  try {
    const cover = await htmlToPdf(browser, renderCoverHtml());
    const emails: Uint8Array[] = [];
    const tickets: Uint8Array[] = [];
    for (const order of SAMPLE_ORDERS) {
      emails.push(await htmlToPdf(browser, await renderEmailHtml(order)));
      tickets.push(await buildSampleTicketPdf(order));
    }
    await write('00-cover.pdf', cover);
    await Promise.all(SAMPLE_ORDERS.map((o, i) => write(`email-${o.key}.pdf`, emails[i])));
    await Promise.all(SAMPLE_ORDERS.map((o, i) => write(`ticket-${o.key}.pdf`, tickets[i])));
    await write('ticket-emails-combined.pdf', await mergePdfs([cover, ...emails, ...tickets]));
  } finally {
    await browser.close();
  }
  console.log(`wrote ${2 * SAMPLE_ORDERS.length + 2} PDFs to ${outDir}`);
}

main().catch((error: unknown) => {
  console.error('generate-ticket-email-samples failed:', error);
  process.exit(1);
});
