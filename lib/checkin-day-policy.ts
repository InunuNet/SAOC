import { computeShowDays } from '@/lib/show-window-lookup';

interface DayPolicyTicket {
  ticketType?: unknown;
  status?: unknown;
  chosenDay?: unknown;
  checkIns?: unknown;
  checkedInAt?: Date | null;
}

interface DayPolicyInput {
  ticket: DayPolicyTicket;
  now: Date;
  window: { startDate: Date; endDate: Date } | null;
  requiresDaySelection: boolean;
}

export type DayAdmissionDecision =
  | { ok: true; day: string; firstAdmission: boolean }
  | { ok: false; code: 'not_show_day' | 'wrong_day' | 'already-checked-in' | 'unpaid'; httpStatus: number; error: string };

export function sastDay(date: Date): string {
  return new Date(date.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function validChosenDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function usableMap(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function decideDayAdmission({ ticket, now, window, requiresDaySelection }: DayPolicyInput): DayAdmissionDecision {
  if (!window || !Number.isFinite(now.getTime()) || !Number.isFinite(window.startDate.getTime()) ||
      !Number.isFinite(window.endDate.getTime()) || window.startDate.getTime() > window.endDate.getTime()) {
    return { ok: false, code: 'not_show_day', httpStatus: 403, error: 'The show is not open today.' };
  }
  const day = sastDay(now);
  if (!computeShowDays(window).includes(day)) {
    return { ok: false, code: 'not_show_day', httpStatus: 403, error: 'The show is not open today.' };
  }
  if (requiresDaySelection) {
    if (!validChosenDay(ticket.chosenDay)) {
      return { ok: false, code: 'wrong_day', httpStatus: 403, error: 'This ticket has no valid selected day. Please contact the ticket desk.' };
    }
    if (ticket.chosenDay !== day) {
      const date = new Date(`${ticket.chosenDay}T00:00:00.000Z`);
      const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' }).format(date);
      const calendarDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
      const label = `${weekday} ${calendarDate}`;
      return { ok: false, code: 'wrong_day', httpStatus: 403, error: `Valid on ${label}` };
    }
  }
  const pass = ticket.ticketType === 'weekend-pass' || ticket.ticketType === 'weekend-pass-early-bird';
  const first = ticket.checkedInAt;
  const hasFirst = Object.prototype.toString.call(first) === '[object Date]' &&
    first !== null && first !== undefined && Number.isFinite(first.getTime());
  const duplicate = pass
    ? (usableMap(ticket.checkIns) && Object.prototype.hasOwnProperty.call(ticket.checkIns, day)) ||
      (hasFirst && sastDay(first) === day) || (ticket.status === 'checked-in' && !hasFirst)
    : ticket.status === 'checked-in';
  if (duplicate) return { ok: false, code: 'already-checked-in', httpStatus: 409, error: 'Already checked in' };
  if (ticket.status !== 'paid' && !(pass && ticket.status === 'checked-in')) {
    return { ok: false, code: 'unpaid', httpStatus: 403, error: 'This ticket has not been paid for.' };
  }
  return { ok: true, day, firstAdmission: ticket.status !== 'checked-in' };
}
