import { readFile } from 'node:fs/promises';
import path from 'node:path';

import fontkit from '@pdf-lib/fontkit';
import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  rgb,
  setCharacterSpacing,
  type Color,
} from 'pdf-lib';
import { create as createQr } from 'qrcode';

/**
 * ticket-pdf (F1) — the NOS A4 ticket, one page per position, drawn at explicit coordinates.
 * Layout, colours and measures follow goldens/layout-spec.md (Codi's ruling wins over the
 * artifact). All text is real embedded text (Fraunces + Karla, never a standard-14 font); the QR
 * is vector rectangles, so it stays crisp and decodes from print. No purchaser or payment data
 * ever reaches this module: its input is only what the confirmation page already shows.
 */

export interface TicketPdfSchedule {
  eyebrow: string | null;
  numeral: string | null;
  dateText: string | null;
  timeText: string | null;
}

export interface TicketPdfTime {
  label: string;
  value: string | null;
}

export interface TicketPdfPosition {
  bookingRef: string;
  attendeeName: string;
  ticketType: string;
  schedule?: TicketPdfSchedule | null;
  timesHeading?: string | null;
  times?: TicketPdfTime[] | null;
}

export interface TicketPdfEmergencyContact {
  number: string;
  label: string;
}

export interface TicketPdfVisit {
  pendingLabel?: string | null;
  venueName: string | null;
  venueAddress: string | null;
  venueParking: string | null;
  showDates: string | null;
  showUrl: string | null;
  emergency: TicketPdfEmergencyContact[];
  onSiteContact: string | null;
  organiser: string | null;
  showOffice: string | null;
  questionsEmail: string | null;
  openingTimes?: TicketPdfTime[] | null;
}

export interface TicketPdfInput {
  orderReference?: string | null;
  positions: TicketPdfPosition[];
  visit: TicketPdfVisit;
}

// ---- units and page ----
const PT_PER_MM = 72 / 25.4;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const mm = (value: number): number => value * PT_PER_MM;

// ---- colour tokens (layout-spec.md) ----
const hex = (value: string): Color =>
  rgb(
    parseInt(value.slice(1, 3), 16) / 255,
    parseInt(value.slice(3, 5), 16) / 255,
    parseInt(value.slice(5, 7), 16) / 255
  );
const ROYAL = hex('#211a57');
const GOLD_100 = hex('#fbfaf0');
const GOLD_200 = hex('#f3f2d6');
const INK = hex('#3a3654');
const MUTED = hex('#6a6780');
const OLIVE = hex('#a7a841');
const RULE = hex('#e3e1c9');
const WHITE = hex('#ffffff');
const BLACK = hex('#000000');
const BAND_TEXT = GOLD_200;

// ---- copy that already exists elsewhere on the site (allowed-strings.txt) ----
const DEFAULT_PENDING_LABEL = 'To be confirmed';
const DEFAULT_TIMES_HEADING = 'Opening times';
const INSTRUCTION = 'Present this ticket — or just the booking reference — at the door for check-in.';
const FOOTER_REG = 'REG# 1978/004040/08 NPO 043-901';
const FOOTER_LINE = 'South African Orchid Council — saoc.co.za';

// ---- layout measures, mm from the top-left (layout-spec.md) ----
const MARGIN_X = 14;
const RIGHT_X = 196;
const CONTENT_WIDTH = RIGHT_X - MARGIN_X;
const CARD_TOP = 38;
const CARD_BOTTOM = 140;
const CARD_RADIUS = 3.7;
const PERFORATION_X = 108.3;
const STUB_PADDING = 9;
const QR_MODULE_AREA_MM = 50;
const QR_QUIET_MODULES = 4;
const QR_PAD_MM = 3.2;
const QR_TILE_TOP = 41;
const BAND_TRACKING = 0.14;
const REF_TRACKING = 0.08;
const PILL_HEIGHT = 4.2;
const PILL_PAD_X = 2.4;
const FONT_DIR = 'lib/ticket-pdf-assets';

interface Fonts {
  display: PDFFont;
  bold: PDFFont;
  body: PDFFont;
}

interface Logos {
  horizontal: PDFImage;
  vertical: PDFImage;
}

interface Ctx {
  page: PDFPage;
  fonts: Fonts;
  logos: Logos;
  pendingLabel: string;
}

interface TextOptions {
  x: number;
  y: number;
  font: PDFFont;
  size: number;
  color: Color;
  tracking?: number;
  align?: 'left' | 'right' | 'center';
  maxWidth?: number;
}

const assetBytes = new Map<string, Promise<Buffer>>();

function readAsset(relative: string): Promise<Buffer> {
  let cached = assetBytes.get(relative);
  if (!cached) {
    cached = readFile(path.join(process.cwd(), FONT_DIR, relative));
    assetBytes.set(relative, cached);
  }
  return cached;
}

// ---- primitives ----

function textWidthPt(text: string, font: PDFFont, size: number, tracking: number): number {
  return font.widthOfTextAtSize(text, size) + tracking * size * Math.max(text.length - 1, 0);
}

function drawText(ctx: Ctx, text: string, options: TextOptions): number {
  const { font, color, x, y, align = 'left', maxWidth } = options;
  const tracking = options.tracking ?? 0;
  let size = options.size;
  if (maxWidth !== undefined) {
    while (size > 5 && textWidthPt(text, font, size, tracking) > mm(maxWidth)) size -= 0.25;
  }
  const width = textWidthPt(text, font, size, tracking);
  const left = align === 'left' ? mm(x) : align === 'right' ? mm(x) - width : mm(x) - width / 2;
  if (tracking) ctx.page.pushOperators(setCharacterSpacing(tracking * size));
  ctx.page.drawText(text, { x: left, y: PAGE_HEIGHT - mm(y), font, size, color });
  if (tracking) ctx.page.pushOperators(setCharacterSpacing(0));
  return width / PT_PER_MM;
}

function fillRect(ctx: Ctx, x: number, y: number, w: number, h: number, color: Color): void {
  ctx.page.drawRectangle({
    x: mm(x),
    y: PAGE_HEIGHT - mm(y + h),
    width: mm(w),
    height: mm(h),
    color,
  });
}

/** Rounded rectangle as an SVG path in pt, y-down; radii: top-left, top-right, bottom-right, bottom-left. */
function roundedPath(x: number, y: number, w: number, h: number, radii: number[]): string {
  const [tl, tr, br, bl] = radii.map(mm);
  const [left, top, width, height] = [mm(x), mm(y), mm(w), mm(h)];
  const arc = (r: number, dx: number, dy: number) =>
    r > 0 ? `A ${r} ${r} 0 0 1 ${left + dx} ${top + dy}` : `L ${left + dx} ${top + dy}`;
  return [
    `M ${left + tl} ${top}`,
    `L ${left + width - tr} ${top}`,
    arc(tr, width, tr),
    `L ${left + width} ${top + height - br}`,
    arc(br, width - br, height),
    `L ${left + bl} ${top + height}`,
    arc(bl, 0, height - bl),
    `L ${left} ${top + tl}`,
    arc(tl, tl, 0),
    'Z',
  ].join(' ');
}

function fillRounded(
  ctx: Ctx,
  box: [number, number, number, number],
  radii: number[],
  color: Color,
  border?: Color
): void {
  ctx.page.drawSvgPath(roundedPath(...box, radii), {
    x: 0,
    y: PAGE_HEIGHT,
    color,
    ...(border ? { borderColor: border, borderWidth: 0.5 } : {}),
  });
}

function dashedLine(
  ctx: Ctx,
  from: [number, number],
  to: [number, number],
  color: Color,
  dash: [number, number]
): void {
  ctx.page.drawLine({
    start: { x: mm(from[0]), y: PAGE_HEIGHT - mm(from[1]) },
    end: { x: mm(to[0]), y: PAGE_HEIGHT - mm(to[1]) },
    thickness: 0.5,
    color,
    dashArray: [mm(dash[0]), mm(dash[1])],
  });
}

function wrap(text: string, font: PDFFont, size: number, maxWidthMm: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > mm(maxWidthMm)) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawWrapped(
  ctx: Ctx,
  text: string,
  at: { x: number; y: number; maxWidth: number; maxLines: number; lineHeight: number },
  size: number
): number {
  const lines = wrap(text, ctx.fonts.body, size, at.maxWidth).slice(0, at.maxLines);
  lines.forEach((line, i) =>
    drawText(ctx, line, {
      x: at.x,
      y: at.y + i * at.lineHeight,
      font: ctx.fonts.body,
      size,
      color: INK,
    })
  );
  return at.y + Math.max(lines.length - 1, 0) * at.lineHeight;
}

/** Outlined "To be confirmed" pill (the single unknown-value marker). `top` is the pill's top edge. */
function drawPill(ctx: Ctx, x: number, top: number): number {
  const label = ctx.pendingLabel.toUpperCase();
  const size = 6.5;
  const textMm = textWidthPt(label, ctx.fonts.bold, size, BAND_TRACKING) / PT_PER_MM;
  const width = textMm + PILL_PAD_X * 2;
  ctx.page.drawSvgPath(roundedPath(x, top, width, PILL_HEIGHT, Array(4).fill(PILL_HEIGHT / 2)), {
    x: 0,
    y: PAGE_HEIGHT,
    borderColor: ROYAL,
    borderWidth: 0.5,
  });
  drawText(ctx, label, {
    x: x + PILL_PAD_X,
    y: top + PILL_HEIGHT / 2 + 0.85,
    font: ctx.fonts.bold,
    size,
    color: ROYAL,
    tracking: BAND_TRACKING,
  });
  return width;
}

function caps(ctx: Ctx, text: string, x: number, y: number, color: Color, size = 7.5): void {
  drawText(ctx, text.toUpperCase(), {
    x,
    y,
    font: ctx.fonts.bold,
    size,
    color,
    tracking: BAND_TRACKING,
  });
}

// ---- bands ----

function drawHeader(ctx: Ctx, index: number, total: number): void {
  fillRect(ctx, 0, 0, A4_WIDTH_MM, 30, ROYAL);
  const { width, height } = ctx.logos.horizontal;
  const logoWidthMm = 70;
  const logoHeightMm = (logoWidthMm * height) / width;
  ctx.page.drawImage(ctx.logos.horizontal, {
    x: mm(17.5),
    y: PAGE_HEIGHT - mm((30 + logoHeightMm) / 2),
    width: mm(logoWidthMm),
    height: mm(logoHeightMm),
  });
  drawText(ctx, 'ADMIT ONE', {
    x: RIGHT_X,
    y: 13,
    font: ctx.fonts.bold,
    size: 8,
    color: BAND_TEXT,
    tracking: BAND_TRACKING,
    align: 'right',
  });
  drawText(ctx, `Ticket ${index + 1} of ${total}`, {
    x: RIGHT_X,
    y: 19,
    font: ctx.fonts.body,
    size: 9,
    color: BAND_TEXT,
    align: 'right',
  });
}

function drawFooter(ctx: Ctx, orderReference: string | null, index: number, total: number): void {
  const top = 262;
  fillRect(ctx, 0, top, A4_WIDTH_MM, A4_HEIGHT_MM - top, ROYAL);
  const { width, height } = ctx.logos.vertical;
  const logoWidthMm = 30;
  const logoHeightMm = (logoWidthMm * height) / width;
  ctx.page.drawImage(ctx.logos.vertical, {
    x: mm(MARGIN_X),
    y: PAGE_HEIGHT - mm(top + (A4_HEIGHT_MM - top + logoHeightMm) / 2),
    width: mm(logoWidthMm),
    height: mm(logoHeightMm),
  });
  const textX = MARGIN_X + logoWidthMm + 8;
  drawText(ctx, FOOTER_REG, {
    x: textX,
    y: 277,
    font: ctx.fonts.bold,
    size: 7.5,
    color: BAND_TEXT,
    tracking: BAND_TRACKING,
  });
  drawText(ctx, FOOTER_LINE, { x: textX, y: 283.5, font: ctx.fonts.body, size: 9, color: BAND_TEXT });
  const page = `PAGE ${index + 1} OF ${total}`;
  drawText(ctx, orderReference ? `ORDER ${orderReference} · ${page}` : page, {
    x: RIGHT_X,
    y: 277,
    font: ctx.fonts.bold,
    size: 7,
    color: BAND_TEXT,
    tracking: BAND_TRACKING,
    align: 'right',
  });
}

// ---- ticket card ----

function drawSchedule(ctx: Ctx, schedule: TicketPdfSchedule | null | undefined, x: number): void {
  const { fonts } = ctx;
  if (schedule?.numeral && schedule.dateText) {
    const numeralWidth = drawText(ctx, schedule.numeral, {
      x,
      y: 80,
      font: fonts.display,
      size: 44,
      color: ROYAL,
    });
    const textX = x + numeralWidth + 4;
    const room = PERFORATION_X - STUB_PADDING * 0.5 - textX;
    drawText(ctx, schedule.dateText, {
      x: textX,
      y: 72.5,
      font: fonts.bold,
      size: 11,
      color: ROYAL,
      maxWidth: room,
    });
    if (schedule.timeText) {
      drawText(ctx, schedule.timeText, {
        x: textX,
        y: 79,
        font: fonts.body,
        size: 10,
        color: INK,
        maxWidth: room,
      });
    } else {
      drawPill(ctx, textX, 74.5);
    }
    return;
  }
  drawPill(ctx, x, 70);
}

function drawStub(ctx: Ctx, position: TicketPdfPosition): void {
  const { fonts } = ctx;
  const x = MARGIN_X + STUB_PADDING;
  const room = PERFORATION_X - x - STUB_PADDING * 0.7;
  if (position.schedule?.eyebrow) caps(ctx, position.schedule.eyebrow, x, 47.5, MUTED, 8);
  drawText(ctx, position.ticketType, {
    x,
    y: 59,
    font: fonts.display,
    size: 30,
    color: ROYAL,
    maxWidth: room,
  });
  fillRect(ctx, x, 63.5, room, 0.5, OLIVE);
  drawSchedule(ctx, position.schedule, x);
  caps(ctx, 'Attendee', x, 98, MUTED);
  drawText(ctx, position.attendeeName, {
    x,
    y: 108,
    font: fonts.display,
    size: 21,
    color: ROYAL,
    maxWidth: room,
  });
  caps(ctx, 'Booking reference', x, 122, MUTED);
  drawText(ctx, position.bookingRef, {
    x,
    y: 130,
    font: fonts.bold,
    size: 11,
    color: ROYAL,
    tracking: REF_TRACKING,
    maxWidth: room,
  });
}

/** QR as one vector path: 50 mm module area, 4-module quiet zone, 3.2 mm tile padding. */
function drawQrTile(ctx: Ctx, bookingRef: string): void {
  const modules = createQr(bookingRef).modules;
  const moduleMm = QR_MODULE_AREA_MM / modules.size;
  const quietMm = QR_QUIET_MODULES * moduleMm + QR_PAD_MM;
  const tileMm = QR_MODULE_AREA_MM + quietMm * 2;
  const centreX = (PERFORATION_X + RIGHT_X) / 2;
  const originX = centreX - QR_MODULE_AREA_MM / 2;
  const originY = QR_TILE_TOP + quietMm;
  fillRect(ctx, centreX - tileMm / 2, QR_TILE_TOP, tileMm, tileMm, WHITE);

  const runs: string[] = [];
  for (let row = 0; row < modules.size; row++) {
    for (let col = 0; col < modules.size; col++) {
      if (!modules.get(row, col)) continue;
      let end = col;
      while (end + 1 < modules.size && modules.get(row, end + 1)) end++;
      const [rx, ry] = [mm(originX + col * moduleMm), mm(originY + row * moduleMm)];
      const rw = mm((end - col + 1) * moduleMm);
      runs.push(`M ${rx} ${ry} h ${rw} v ${mm(moduleMm)} h ${-rw} Z`);
      col = end;
    }
  }
  ctx.page.drawSvgPath(runs.join(' '), { x: 0, y: PAGE_HEIGHT, color: BLACK });

  const labelY = QR_TILE_TOP + tileMm + 7;
  drawText(ctx, 'SCAN AT THE DOOR', {
    x: centreX,
    y: labelY,
    font: ctx.fonts.bold,
    size: 8,
    color: ROYAL,
    tracking: BAND_TRACKING,
    align: 'center',
  });
  drawText(ctx, bookingRef, {
    x: centreX,
    y: labelY + 7,
    font: ctx.fonts.display,
    size: 12,
    color: ROYAL,
    tracking: REF_TRACKING,
    align: 'center',
    maxWidth: RIGHT_X - PERFORATION_X - 8,
  });
}

function drawCard(ctx: Ctx, position: TicketPdfPosition): void {
  const height = CARD_BOTTOM - CARD_TOP;
  fillRounded(
    ctx,
    [MARGIN_X, CARD_TOP, PERFORATION_X - MARGIN_X, height],
    [CARD_RADIUS, 0, 0, CARD_RADIUS],
    GOLD_200,
    RULE
  );
  fillRounded(
    ctx,
    [PERFORATION_X, CARD_TOP, RIGHT_X - PERFORATION_X, height],
    [0, CARD_RADIUS, CARD_RADIUS, 0],
    WHITE,
    RULE
  );
  dashedLine(ctx, [PERFORATION_X, CARD_TOP + 1], [PERFORATION_X, CARD_BOTTOM - 1], ROYAL, [1.2, 1]);
  drawStub(ctx, position);
  drawQrTile(ctx, position.bookingRef);
}

function drawFoldRule(ctx: Ctx): void {
  const y = 146;
  dashedLine(ctx, [MARGIN_X, y], [RIGHT_X, y], MUTED, [2, 1.5]);
  const label = 'FOLD HERE';
  const width = textWidthPt(label, ctx.fonts.bold, 7, BAND_TRACKING) / PT_PER_MM;
  fillRect(ctx, 105 - width / 2 - 3, y - 2.2, width + 6, 4.4, GOLD_100);
  drawText(ctx, label, {
    x: 105,
    y: y + 0.9,
    font: ctx.fonts.bold,
    size: 7,
    color: MUTED,
    tracking: BAND_TRACKING,
    align: 'center',
  });
}

// ---- visit information ----

function heading(ctx: Ctx, text: string, x: number, y: number): void {
  drawText(ctx, text, { x, y, font: ctx.fonts.display, size: 13, color: ROYAL });
}

function rowOrPill(ctx: Ctx, value: string | null, x: number, y: number, maxWidth: number): number {
  if (!value) {
    drawPill(ctx, x, y - 3.2);
    return y + PILL_HEIGHT;
  }
  return drawWrapped(ctx, value, { x, y, maxWidth, maxLines: 3, lineHeight: 4.2 }, 9.5) + 4.6;
}

function drawVenueColumn(ctx: Ctx, visit: TicketPdfVisit): void {
  const x = MARGIN_X;
  heading(ctx, 'The venue', x, 158);
  let y = rowOrPill(ctx, visit.venueName, x, 164, 62);
  y = rowOrPill(ctx, visit.venueAddress, x, y, 62);
  caps(ctx, 'Parking and entrance', x, y + 1, MUTED, 6.5);
  rowOrPill(ctx, visit.venueParking, x, y + 5.5, 62);
}

function drawTimesColumn(ctx: Ctx, position: TicketPdfPosition, visit: TicketPdfVisit): void {
  const x = 82;
  heading(ctx, position.timesHeading ?? DEFAULT_TIMES_HEADING, x, 158);
  const times = position.times ?? visit.openingTimes ?? [];
  if (times.length === 0) {
    rowOrPill(ctx, null, x, 164, 56);
    return;
  }
  times.slice(0, 5).forEach((time, i) => {
    const y = 164 + i * 5.6;
    drawText(ctx, time.label, { x, y, font: ctx.fonts.bold, size: 9, color: ROYAL });
    if (time.value) {
      drawText(ctx, time.value, { x: x + 16, y, font: ctx.fonts.body, size: 9.5, color: INK, maxWidth: 40 });
    } else {
      drawPill(ctx, x + 16, y - 3.2);
    }
  });
}

function drawDatesColumn(ctx: Ctx, visit: TicketPdfVisit): void {
  const x = 142.7;
  heading(ctx, 'Show dates', x, 158);
  const y = rowOrPill(ctx, visit.showDates, x, 164, RIGHT_X - x);
  if (visit.showUrl) {
    drawText(ctx, visit.showUrl, { x, y, font: ctx.fonts.body, size: 9.5, color: INK, maxWidth: RIGHT_X - x });
  }
}

function drawEmergency(ctx: Ctx, visit: TicketPdfVisit): void {
  fillRounded(ctx, [MARGIN_X, 198, CONTENT_WIDTH, 30], Array(4).fill(CARD_RADIUS), GOLD_200);
  heading(ctx, 'In an emergency', 18, 206);
  const columns = [18, 58, 98];
  if (visit.emergency.length === 0) drawPill(ctx, columns[0], 211);
  visit.emergency.slice(0, 3).forEach((contact, i) => {
    drawText(ctx, contact.number, {
      x: columns[i],
      y: 217,
      font: ctx.fonts.display,
      size: 22,
      color: ROYAL,
    });
    drawWrapped(ctx, contact.label, { x: columns[i], y: 221.6, maxWidth: 36, maxLines: 2, lineHeight: 3.4 }, 8.5);
  });
  caps(ctx, 'On-site first aid and show duty contact', 138, 209.5, MUTED, 5.5);
  if (visit.onSiteContact) {
    drawWrapped(ctx, visit.onSiteContact, { x: 138, y: 215, maxWidth: 54, maxLines: 3, lineHeight: 4 }, 9.5);
  } else {
    drawPill(ctx, 138, 212);
  }
}

function drawOrganiser(ctx: Ctx, visit: TicketPdfVisit): void {
  heading(ctx, 'Organiser', MARGIN_X, 237);
  if (visit.organiser) {
    drawText(ctx, visit.organiser, { x: MARGIN_X, y: 242.5, font: ctx.fonts.body, size: 9.5, color: INK });
  }
  caps(ctx, 'Show office', MARGIN_X, 247.5, MUTED, 6.5);
  if (visit.showOffice) {
    drawText(ctx, visit.showOffice, { x: MARGIN_X + 22, y: 247.5, font: ctx.fonts.body, size: 9.5, color: INK });
  } else {
    drawPill(ctx, MARGIN_X + 22, 244.3);
  }
  heading(ctx, 'Questions', 108, 237);
  if (visit.questionsEmail) {
    drawText(ctx, visit.questionsEmail, { x: 108, y: 242.5, font: ctx.fonts.body, size: 9.5, color: INK });
  } else {
    drawPill(ctx, 108, 239.3);
  }
  drawText(ctx, 'Quote your booking reference.', { x: 108, y: 247.5, font: ctx.fonts.body, size: 9.5, color: INK });
}

function drawPage(
  ctx: Ctx,
  input: TicketPdfInput,
  position: TicketPdfPosition,
  index: number
): void {
  fillRect(ctx, 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM, GOLD_100);
  drawHeader(ctx, index, input.positions.length);
  drawCard(ctx, position);
  drawFoldRule(ctx);
  drawVenueColumn(ctx, input.visit);
  drawTimesColumn(ctx, position, input.visit);
  drawDatesColumn(ctx, input.visit);
  drawEmergency(ctx, input.visit);
  drawOrganiser(ctx, input.visit);
  drawText(ctx, INSTRUCTION, { x: MARGIN_X, y: 257, font: ctx.fonts.body, size: 9, color: INK, maxWidth: CONTENT_WIDTH });
  drawFooter(ctx, input.orderReference ?? null, index, input.positions.length);
}

async function loadAssets(pdf: PDFDocument): Promise<{ fonts: Fonts; logos: Logos }> {
  const [display, bold, body, horizontal, vertical] = await Promise.all([
    readAsset('Fraunces-Light.ttf'),
    readAsset('Karla-Bold.ttf'),
    readAsset('fonts/Karla-Regular.woff'),
    readAsset('nos-reversed-gold-horizontal-1600.png'),
    readAsset('nos-reversed-gold-vertical-700.png'),
  ]);
  return {
    fonts: {
      display: await pdf.embedFont(display, { subset: true }),
      bold: await pdf.embedFont(bold, { subset: true }),
      body: await pdf.embedFont(body, { subset: true }),
    },
    logos: {
      horizontal: await pdf.embedPng(horizontal),
      vertical: await pdf.embedPng(vertical),
    },
  };
}

export async function buildTicketPdf(input: TicketPdfInput): Promise<Uint8Array> {
  if (input.positions.length === 0) {
    throw new Error('buildTicketPdf: at least one position is required');
  }
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const { fonts, logos } = await loadAssets(pdf);
  const ctx = {
    fonts,
    logos,
    pendingLabel: input.visit.pendingLabel?.trim() || DEFAULT_PENDING_LABEL,
  };
  input.positions.forEach((position, index) => {
    drawPage({ ...ctx, page: pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]) }, input, position, index);
  });
  pdf.setTitle(`Ticket ${input.positions[0].bookingRef}`);
  pdf.setLanguage('en-ZA');
  pdf.setProducer('pdf-lib');
  pdf.setCreator('pdf-lib');
  pdf.setAuthor('');
  return pdf.save();
}
