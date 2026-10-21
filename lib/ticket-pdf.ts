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
const BAND_TEXT = GOLD_200; // text on the royal header band

// ---- copy that already exists elsewhere on the site (allowed-strings.txt) ----
const DEFAULT_PENDING_LABEL = 'To be confirmed';
const DEFAULT_TIMES_HEADING = 'Opening times';
const INSTRUCTION = 'Present this ticket at the door for check in.';
const FOOTER_REG = 'REG# 1978/004040/08 · NPO 043-901';
const FOOTER_LINE = 'South African Orchid Council — saoc.co.za';

// ---- layout measures, mm from the top-left (layout-spec.md, Codi's artifact) ----
const MARGIN_X = 13.9;
const RIGHT_X = 196;
const CONTENT_WIDTH = RIGHT_X - MARGIN_X;
const HEADER_HEIGHT = 29.8;
const HEADER_LOGO_WIDTH = 70.3;
const CARD_TOP = 40;
const CARD_BOTTOM = 143.9;
const CARD_RADIUS = 3.7;
const PERFORATION_X = 108.3;
const STUB_TEXT_X = 22.9;
const QR_MODULE_AREA_MM = 55;
const QR_TOP = 58.4;
const VISIT_HEADING_Y = 155.5;
const BAND_TRACKING = 0.14;
const REF_TRACKING = 0.08;
const PILL_HEIGHT = 4.2;
const PILL_PAD_X = 2.4;
const FOOTNOTE_SIZE = 9;
const FOOTNOTE_Y = 256;
const FOOTNOTE_LINE_PITCH = 4.6;
const INSTRUCTION_Y = 248;
const FOOTER_RULE_Y = 265.5;
const FOOTER_MARK_TOP = 268.5;
const FOOTER_TEXT_Y = 272.5;
const FOOTER_LINE_PITCH = 4.6;
const HEADER_LOGO_LEFT_PAD = 192 / 4108; // transparent left margin of the logo file, as a fraction of its width
const FOOTER_SMALL_SIZE = 7.5;
const FOOTER_MARK_HEIGHT = 12.7;
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
  size: number,
  color: Color = INK
): number {
  const lines = wrap(text, ctx.fonts.body, size, at.maxWidth).slice(0, at.maxLines);
  lines.forEach((line, i) =>
    drawText(ctx, line, {
      x: at.x,
      y: at.y + i * at.lineHeight,
      font: ctx.fonts.body,
      size,
      color,
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

// ---- header ----

function drawHeader(ctx: Ctx, index: number, total: number): void {
  fillRect(ctx, 0, 0, A4_WIDTH_MM, HEADER_HEIGHT, ROYAL);
  const { width, height } = ctx.logos.horizontal;
  const logoHeightMm = (HEADER_LOGO_WIDTH * height) / width;
  ctx.page.drawImage(ctx.logos.horizontal, {
    x: mm(MARGIN_X - HEADER_LOGO_LEFT_PAD * HEADER_LOGO_WIDTH),
    y: PAGE_HEIGHT - mm((HEADER_HEIGHT + logoHeightMm) / 2),
    width: mm(HEADER_LOGO_WIDTH),
    height: mm(logoHeightMm),
  });
  drawText(ctx, 'ADMIT ONE', {
    x: RIGHT_X,
    y: 11.5,
    font: ctx.fonts.bold,
    size: 7.5,
    color: BAND_TEXT,
    tracking: BAND_TRACKING,
    align: 'right',
  });
  drawText(ctx, `Ticket ${index + 1} of ${total}`, {
    x: RIGHT_X,
    y: 17.3,
    font: ctx.fonts.body,
    size: 8.5,
    color: BAND_TEXT,
    align: 'right',
  });
}

// ---- ticket card ----

function drawSchedule(ctx: Ctx, schedule: TicketPdfSchedule | null | undefined, x: number): void {
  const { fonts } = ctx;
  if (schedule?.numeral && schedule.dateText) {
    const numeralWidth = drawText(ctx, schedule.numeral, {
      x,
      y: 88,
      font: fonts.display,
      size: 44,
      color: ROYAL,
    });
    const textX = x + numeralWidth + 4;
    const room = PERFORATION_X - 6 - textX;
    drawText(ctx, schedule.dateText, {
      x: textX,
      y: 86.9,
      font: fonts.bold,
      size: 10.5,
      color: ROYAL,
      maxWidth: room,
    });
    if (schedule.timeText) {
      drawText(ctx, schedule.timeText, {
        x: textX,
        y: 92,
        font: fonts.body,
        size: 10,
        color: INK,
        maxWidth: room,
      });
    } else {
      drawPill(ctx, textX, 88.6);
    }
    return;
  }
  if (schedule?.dateText) {
    drawText(ctx, schedule.dateText, {
      x,
      y: 86.9,
      font: fonts.bold,
      size: 10.5,
      color: ROYAL,
      maxWidth: PERFORATION_X - 6 - x,
    });
    if (schedule.timeText) {
      drawText(ctx, schedule.timeText, { x, y: 92, font: fonts.body, size: 10, color: INK });
    }
    return;
  }
  drawPill(ctx, x, 79);
}

function drawStub(ctx: Ctx, position: TicketPdfPosition): void {
  const { fonts } = ctx;
  const x = STUB_TEXT_X;
  const room = 100 - x;
  if (position.schedule?.eyebrow) caps(ctx, position.schedule.eyebrow, x, 50.4, MUTED, 7.5);
  drawText(ctx, position.ticketType, {
    x,
    y: 63.5,
    font: fonts.display,
    size: 29,
    color: ROYAL,
    maxWidth: room,
  });
  fillRect(ctx, x, 71.6, room, 0.5, OLIVE);
  drawSchedule(ctx, position.schedule, x);
  caps(ctx, 'Attendee', x, 110.4, MUTED);
  drawText(ctx, position.attendeeName, {
    x,
    y: 115.5,
    font: fonts.bold,
    size: 12,
    color: ROYAL,
    maxWidth: room,
  });
  caps(ctx, 'Booking reference', x, 123.6, MUTED);
  drawText(ctx, position.bookingRef, {
    x,
    y: 128.9,
    font: fonts.bold,
    size: 11,
    color: ROYAL,
    tracking: REF_TRACKING,
    maxWidth: room,
  });
}

/** QR as one vector path: ~55 mm of black modules on the white tile (the tile is the quiet zone). */
function drawQrTile(ctx: Ctx, bookingRef: string): void {
  const modules = createQr(bookingRef).modules;
  const moduleMm = QR_MODULE_AREA_MM / modules.size;
  const centreX = (PERFORATION_X + RIGHT_X) / 2;
  const originX = centreX - QR_MODULE_AREA_MM / 2;

  const runs: string[] = [];
  for (let row = 0; row < modules.size; row++) {
    for (let col = 0; col < modules.size; col++) {
      if (!modules.get(row, col)) continue;
      let end = col;
      while (end + 1 < modules.size && modules.get(row, end + 1)) end++;
      const [rx, ry] = [mm(originX + col * moduleMm), mm(QR_TOP + row * moduleMm)];
      const rw = mm((end - col + 1) * moduleMm);
      runs.push(`M ${rx} ${ry} h ${rw} v ${mm(moduleMm)} h ${-rw} Z`);
      col = end;
    }
  }
  ctx.page.drawSvgPath(runs.join(' '), { x: 0, y: PAGE_HEIGHT, color: BLACK });

  drawText(ctx, 'SCAN AT THE DOOR', {
    x: centreX,
    y: 125.9,
    font: ctx.fonts.bold,
    size: 7,
    color: ROYAL,
    tracking: BAND_TRACKING,
    align: 'center',
  });
  drawText(ctx, bookingRef, {
    x: centreX,
    y: 131.7,
    font: ctx.fonts.bold,
    size: 10.5,
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
  dashedLine(ctx, [PERFORATION_X, CARD_TOP + 1], [PERFORATION_X, CARD_BOTTOM - 1], ROYAL, [1, 1]);
  drawStub(ctx, position);
  drawQrTile(ctx, position.bookingRef);
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
  return drawWrapped(ctx, value, { x, y, maxWidth, maxLines: 3, lineHeight: 4.6 }, 9) + 5;
}

function drawVenueColumn(ctx: Ctx, visit: TicketPdfVisit): void {
  const x = MARGIN_X;
  heading(ctx, 'The venue', x, VISIT_HEADING_Y);
  if (visit.venueName) {
    drawText(ctx, visit.venueName, { x, y: 163, font: ctx.fonts.bold, size: 9, color: ROYAL, maxWidth: 62 });
  } else {
    drawPill(ctx, x, 159.8);
  }
  const y = rowOrPill(ctx, visit.venueAddress, x, 168, 62);
  caps(ctx, 'Parking and entrance', x, y + 1, MUTED, 6.5);
  rowOrPill(ctx, visit.venueParking, x, y + 5.5, 62);
}

function drawTimesColumn(ctx: Ctx, position: TicketPdfPosition, visit: TicketPdfVisit): void {
  const x = 82.2;
  heading(ctx, position.timesHeading ?? DEFAULT_TIMES_HEADING, x, VISIT_HEADING_Y);
  const times = position.times ?? visit.openingTimes ?? [];
  if (times.length === 0) {
    rowOrPill(ctx, null, x, 164, 56);
    return;
  }
  times.slice(0, 5).forEach((time, i) => {
    const y = 164 + i * 7;
    drawText(ctx, time.label, { x, y, font: ctx.fonts.bold, size: 9, color: ROYAL });
    if (time.value) {
      drawText(ctx, time.value, { x: x + 16, y, font: ctx.fonts.body, size: 9, color: INK, maxWidth: 40 });
    } else {
      drawPill(ctx, x + 16, y - 3.2);
    }
  });
}

function drawDatesColumn(ctx: Ctx, visit: TicketPdfVisit): void {
  const x = 142.5;
  heading(ctx, 'Show dates', x, VISIT_HEADING_Y);
  const y = rowOrPill(ctx, visit.showDates, x, 163, RIGHT_X - x);
  if (visit.showUrl) {
    drawText(ctx, visit.showUrl, { x, y, font: ctx.fonts.body, size: 9, color: INK, maxWidth: RIGHT_X - x });
  }
}

// ---- footnote and footer ----

/** One 12px footnote: the emergency numbers on one line, the on-site contact (or its pill) after. */
function drawEmergencyFootnote(ctx: Ctx, visit: TicketPdfVisit): void {
  const { fonts } = ctx;
  const prefix = 'In an emergency:';
  const prefixWidth = drawText(ctx, prefix, {
    x: MARGIN_X,
    y: FOOTNOTE_Y,
    font: fonts.bold,
    size: FOOTNOTE_SIZE,
    color: MUTED,
  });
  const numbers = visit.emergency.map((contact) => `${contact.number} ${contact.label}`).join(' · ');
  if (numbers) {
    drawWrapped(
      ctx,
      numbers,
      { x: MARGIN_X + prefixWidth + 1.5, y: FOOTNOTE_Y, maxWidth: CONTENT_WIDTH - prefixWidth - 1.5, maxLines: 1, lineHeight: 4.4 },
      FOOTNOTE_SIZE,
      MUTED
    );
  } else {
    drawPill(ctx, MARGIN_X + prefixWidth + 2, FOOTNOTE_Y - 3.2);
  }
  const onSite = 'On-site first aid and show duty contact';
  const onSiteWidth = drawText(ctx, onSite, {
    x: MARGIN_X,
    y: FOOTNOTE_Y + FOOTNOTE_LINE_PITCH,
    font: fonts.bold,
    size: FOOTNOTE_SIZE,
    color: MUTED,
  });
  if (visit.onSiteContact) {
    drawText(ctx, visit.onSiteContact, {
      x: MARGIN_X + onSiteWidth + 2,
      y: FOOTNOTE_Y + FOOTNOTE_LINE_PITCH,
      font: fonts.body,
      size: FOOTNOTE_SIZE,
      color: MUTED,
    });
  } else {
    drawPill(ctx, MARGIN_X + onSiteWidth + 2, FOOTNOTE_Y + FOOTNOTE_LINE_PITCH - 3.2);
  }
}

function drawFooter(
  ctx: Ctx,
  input: TicketPdfInput,
  index: number
): void {
  const { fonts, logos, pendingLabel } = ctx;
  const { visit } = input;
  const page = `PAGE ${index + 1} OF ${input.positions.length}`;
  drawText(ctx, INSTRUCTION, { x: MARGIN_X, y: INSTRUCTION_Y, font: fonts.body, size: 9, color: INK, maxWidth: CONTENT_WIDTH });
  fillRect(ctx, MARGIN_X, FOOTER_RULE_Y, CONTENT_WIDTH, 0.1, RULE);

  const { width, height } = logos.vertical;
  const markWidth = (FOOTER_MARK_HEIGHT * width) / height;
  ctx.page.drawImage(logos.vertical, {
    x: mm(MARGIN_X),
    y: PAGE_HEIGHT - mm(FOOTER_MARK_TOP + FOOTER_MARK_HEIGHT),
    width: mm(markWidth),
    height: mm(FOOTER_MARK_HEIGHT),
  });
  const x = MARGIN_X + markWidth + 4;
  const y3 = FOOTER_TEXT_Y + FOOTER_LINE_PITCH * 2;
  const text = (value: string, at: number, y: number, size: number): number =>
    drawText(ctx, value, { x: at, y, font: fonts.body, size, color: MUTED });
  text(FOOTER_LINE, x, FOOTER_TEXT_Y, FOOTNOTE_SIZE);
  text(FOOTER_REG, x, FOOTER_TEXT_Y + FOOTER_LINE_PITCH, FOOTNOTE_SIZE);
  const lead = text(`Organiser: ${visit.organiser ?? pendingLabel} · Show office`, x, y3, FOOTER_SMALL_SIZE);
  const cursor = x + lead + 1.5;
  if (visit.showOffice) {
    text(visit.showOffice, cursor, y3, FOOTER_SMALL_SIZE);
  } else {
    drawPill(ctx, cursor, y3 - 3.2);
  }
  text(`Questions: ${visit.questionsEmail ?? pendingLabel} · Quote your booking reference.`, x, y3 + FOOTER_LINE_PITCH - 0.4, FOOTER_SMALL_SIZE);
  drawText(ctx, input.orderReference ? `ORDER ${input.orderReference} · ${page}` : page, {
    x: RIGHT_X,
    y: FOOTER_TEXT_Y,
    font: fonts.bold,
    size: 6.5,
    color: MUTED,
    tracking: BAND_TRACKING,
    align: 'right',
  });
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
  drawVenueColumn(ctx, input.visit);
  drawTimesColumn(ctx, position, input.visit);
  drawDatesColumn(ctx, input.visit);
  drawEmergencyFootnote(ctx, input.visit);
  drawFooter(ctx, input, index);
}

async function loadAssets(pdf: PDFDocument): Promise<{ fonts: Fonts; logos: Logos }> {
  const [display, bold, body, horizontal, vertical] = await Promise.all([
    readAsset('Fraunces-Light.ttf'),
    readAsset('Karla-Bold.ttf'),
    readAsset('fonts/Karla-Regular.woff'),
    readAsset('nos-full-colour-reversed-horizontal-1600.png'),
    readAsset('nos-ink-purple-vertical-500.png'),
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
