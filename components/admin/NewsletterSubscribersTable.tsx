'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { formatAdminDate, formatAdminDateTime } from '@/lib/admin-format';
import { NEWSLETTER_COPY } from '@/lib/newsletter-copy';
import {
  rowLists,
  type NewsletterListFilter,
  type NewsletterStatusFilter,
} from '@/lib/newsletter-preferences';
import type { NewsletterTopic } from '@/lib/newsletter-topics';
import { DetailDrawer } from './DetailDrawer';
import { StatusPill } from './StatusPill';
import { AdminTable } from './table/AdminTable';
import type { ColumnDef } from './table/columns';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, FOCUS_RING } from './tokens';

/** Serialisable view of a subscriber: Firestore Timestamps never cross into this client module. */
export interface SubscriberRow {
  id: string;
  email: string;
  source: string;
  status: 'subscribed' | 'unsubscribed';
  topics: NewsletterTopic[];
  topicRemovals: { topic: NewsletterTopic; removedAt: string | null }[];
  restoreTopics: NewsletterTopic[];
  subscribedAt: string | null;
}

interface NewsletterSubscribersTableProps {
  rows: readonly SubscriberRow[];
  list: NewsletterListFilter;
  status: NewsletterStatusFilter;
  /** Rows per list under the current status filter, shown beside each list in the filter. */
  counts: Record<NewsletterListFilter, number>;
  /** Decided on the server from the admin's role; the API route enforces it again. */
  canManage: boolean;
}

// Admin microcopy on the shared EMPTY_TEXT pattern (Codi ruling 2026-10-22; Brad may change).
const EMPTY_TEXT = 'No one has subscribed yet.';
// The "All" entry of both filters (SAOC ruling: the word is inline, not a copy key).
const ALL_LABEL = 'All';

// "Signed up via" is last: the lists and the status are what an admin scans for.
const SUBSCRIBER_COLUMNS: readonly ColumnDef[] = [
  { id: 'email', label: NEWSLETTER_COPY.adminColumnEmail, width: '28%', priority: 1, align: 'left' },
  { id: 'lists', label: NEWSLETTER_COPY.adminColumnLists, width: '22%', priority: 1, align: 'left' },
  { id: 'status', label: NEWSLETTER_COPY.adminColumnStatus, width: '22%', priority: 1, align: 'left' },
  { id: 'subscribed', label: NEWSLETTER_COPY.adminColumnSubscribed, width: '14%', priority: 2, align: 'right' },
  { id: 'source', label: NEWSLETTER_COPY.adminColumnSource, width: '14%', priority: 3, align: 'left' },
];

// Status pill tone: subscribed reads as the solid "approved" pill, unsubscribed as the muted outline.
const STATUS_TONE: Record<SubscriberRow['status'], string> = {
  subscribed: 'approved',
  unsubscribed: 'declined',
};

const STATUS_LABEL: Record<SubscriberRow['status'], string> = {
  subscribed: NEWSLETTER_COPY.adminColumnSubscribed,
  unsubscribed: NEWSLETTER_COPY.adminStatusUnsubscribed,
};

// Display labels for the stored source slugs; an unknown slug is shown as stored.
const SOURCE_LABELS: Record<string, string> = {
  'saoc-footer': NEWSLETTER_COPY.adminSourceSaoc,
  'nos-footer': NEWSLETTER_COPY.adminSourceNos,
};

const TOPIC_LABELS: Record<NewsletterTopic, string> = {
  saoc: NEWSLETTER_COPY.adminSourceSaoc,
  nos: NEWSLETTER_COPY.adminSourceNos,
};

const LIST_OPTIONS: readonly { value: NewsletterListFilter; label: string }[] = [
  { value: 'all', label: ALL_LABEL },
  { value: 'saoc', label: NEWSLETTER_COPY.adminSourceSaoc },
  { value: 'nos', label: NEWSLETTER_COPY.adminSourceNos },
];

const STATUS_OPTIONS: readonly { value: NewsletterStatusFilter; label: string }[] = [
  { value: 'subscribed', label: NEWSLETTER_COPY.adminColumnSubscribed },
  { value: 'unsubscribed', label: NEWSLETTER_COPY.adminStatusUnsubscribed },
  { value: 'all', label: ALL_LABEL },
];

const SELECT_CLASS = `h-11 min-w-0 rounded-[2px] border border-rule bg-ivory px-3 font-sans text-[16px] text-ink ${FOCUS_RING}`;
const FIELD_LABEL_CLASS = 'font-mono text-[11px] uppercase tracking-[0.12em] text-muted';
const ROW_ACTION_CLASS = `min-h-[44px] px-2 font-sans text-[14px] font-semibold text-primary underline decoration-accent underline-offset-4 hover:text-primary-800 ${FOCUS_RING}`;

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

function removalOf(row: SubscriberRow, topic: NewsletterTopic): SubscriberRow['topicRemovals'][number] | undefined {
  return row.topicRemovals.filter((entry) => entry.topic === topic).at(-1);
}

function renderLists(row: SubscriberRow): React.ReactNode {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {rowLists(row).map((topic) =>
        row.topics.includes(topic) ? (
          <StatusPill key={topic} status="neutral" label={TOPIC_LABELS[topic]} />
        ) : (
          <StatusPill key={topic} status="cancelled" label={TOPIC_LABELS[topic]} textClassName="line-through" />
        ),
      )}
    </span>
  );
}

function listsText(row: SubscriberRow): string {
  return rowLists(row).map((topic) => TOPIC_LABELS[topic]).join(', ');
}

function removalTitle(row: SubscriberRow): string | undefined {
  const removed = rowLists(row).filter((topic) => !row.topics.includes(topic));
  if (removed.length === 0) return undefined;
  return removed
    .map((topic) => `${TOPIC_LABELS[topic]} · ${formatAdminDate(removalOf(row, topic)?.removedAt ?? null)}`)
    .join('\n');
}

export function NewsletterSubscribersTable({ rows, list, status, counts, canManage }: NewsletterSubscribersTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [target, setTarget] = useState<SubscriberRow | null>(null);
  const [chosen, setChosen] = useState<NewsletterTopic[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const returnToRef = useRef<string | null>(null);

  // After the dialog closes, focus goes back to the row's action. After a full removal the action is
  // about to disappear on refresh, so the row's inline status takes focus first.
  useEffect(() => {
    if (target !== null || returnToRef.current === null) return;
    const id = returnToRef.current;
    returnToRef.current = null;
    const visible = (el: Element) => (el as HTMLElement).offsetParent !== null;
    const action = document.querySelectorAll(`[data-newsletter-action="${CSS.escape(id)}"]`);
    const status = document.querySelectorAll(`[data-newsletter-status="${CSS.escape(id)}"]`);
    const candidates = [...(done.has(id) ? [...status, ...action] : [...action, ...status])].filter(visible);
    (candidates[0] as HTMLElement | undefined)?.focus();
  }, [target, rows, done]);

  function navigate(next: { list?: string; status?: string }) {
    const params = new URLSearchParams(window.location.search);
    params.set('list', next.list ?? list);
    params.set('status', next.status ?? status);
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  function openDialog(row: SubscriberRow) {
    setTarget(row);
    setChosen(row.topics);
    setError('');
    returnToRef.current = row.id;
  }

  function closeDialog() {
    if (!busy) setTarget(null);
  }

  function toggle(topic: NewsletterTopic, checked: boolean) {
    setChosen((current) => (checked ? [...current, topic] : current.filter((item) => item !== topic)));
  }

  async function confirm() {
    if (target === null || chosen.length === 0 || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: target.id, topics: chosen }),
      });
      if (!res.ok) {
        setError(NEWSLETTER_COPY.genericError);
        return;
      }
      // "Unsubscribed" is for a full removal only; a partial removal leaves the remaining list chips.
      if (target.topics.every((topic) => chosen.includes(topic))) {
        setDone((current) => new Set(current).add(target.id));
      }
      setTarget(null);
      startTransition(() => router.refresh());
    } catch {
      setError(NEWSLETTER_COPY.genericError);
    } finally {
      setBusy(false);
    }
  }

  function renderStatus(row: SubscriberRow): React.ReactNode {
    return (
      <span className="flex flex-wrap items-center gap-x-2">
        <StatusPill status={row.status} label={STATUS_LABEL[row.status]} tone={STATUS_TONE[row.status]} />
        {canManage && row.status === 'subscribed' ? (
          <button
            type="button"
            data-newsletter-action={row.id}
            onClick={() => openDialog(row)}
            aria-label={`${NEWSLETTER_COPY.adminUnsubscribeRow} ${row.email}`}
            className={ROW_ACTION_CLASS}
          >
            {NEWSLETTER_COPY.adminUnsubscribeRow}
          </button>
        ) : null}
        {done.has(row.id) ? (
          <span
            role="status"
            tabIndex={-1}
            data-newsletter-status={row.id}
            className="font-sans text-[13px] text-muted focus:outline-none"
          >
            {NEWSLETTER_COPY.adminRowUnsubscribedStatus}
          </span>
        ) : null}
      </span>
    );
  }

  function renderCell(columnId: string, row: SubscriberRow): React.ReactNode {
    switch (columnId) {
      case 'email':
        return row.email;
      case 'lists':
        return renderLists(row);
      case 'status':
        return renderStatus(row);
      case 'subscribed':
        return formatAdminDate(row.subscribedAt);
      case 'source':
        return sourceLabel(row.source);
      default:
        return null;
    }
  }

  function cellTitle(columnId: string, row: SubscriberRow): string | undefined {
    switch (columnId) {
      case 'email':
        return row.email;
      case 'lists':
        return removalTitle(row);
      case 'subscribed':
        return formatAdminDateTime(row.subscribedAt);
      default:
        return undefined;
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="newsletter-filter-list" className={FIELD_LABEL_CLASS}>
            {NEWSLETTER_COPY.adminFilterLists}
          </label>
          <select
            id="newsletter-filter-list"
            value={list}
            onChange={(event) => navigate({ list: event.target.value })}
            className={SELECT_CLASS}
          >
            {LIST_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {`${option.label} (${counts[option.value]})`}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="newsletter-filter-status" className={FIELD_LABEL_CLASS}>
            {NEWSLETTER_COPY.adminColumnStatus}
          </label>
          <select
            id="newsletter-filter-status"
            value={status}
            onChange={(event) => navigate({ status: event.target.value })}
            className={SELECT_CLASS}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <AdminTable
        caption={NEWSLETTER_COPY.adminHeading}
        columns={SUBSCRIBER_COLUMNS}
        rows={rows}
        getRowId={(row) => row.id}
        renderCell={renderCell}
        cellTitle={cellTitle}
        sortedDescColumnId="subscribed"
        emptyText={EMPTY_TEXT}
        card={(row) => ({
          title: row.email,
          status: renderStatus(row),
          fields: [
            { label: NEWSLETTER_COPY.adminColumnLists, value: listsText(row) },
            { label: NEWSLETTER_COPY.adminColumnSubscribed, value: formatAdminDate(row.subscribedAt) },
            { label: NEWSLETTER_COPY.adminColumnSource, value: sourceLabel(row.source) },
          ],
        })}
      />

      <DetailDrawer
        open={target !== null}
        title={target ? NEWSLETTER_COPY.adminConfirmPrompt.replace('{email}', target.email) : ''}
        onClose={closeDialog}
        footer={
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={busy || chosen.length === 0}
              aria-busy={busy}
              className={BUTTON_PRIMARY}
            >
              {NEWSLETTER_COPY.adminUnsubscribeButton}
            </button>
            <button type="button" onClick={closeDialog} disabled={busy} className={BUTTON_SECONDARY}>
              {NEWSLETTER_COPY.adminConfirmCancel}
            </button>
          </div>
        }
      >
        {target ? (
          <>
            {error === '' ? null : (
              <p role="alert" className="mb-4 border border-rule bg-ivory px-4 py-3 font-sans text-[14px] text-ink">
                {error}
              </p>
            )}
            <fieldset className="flex flex-col">
              <legend className={`mb-2 ${FIELD_LABEL_CLASS}`}>{NEWSLETTER_COPY.adminConfirmLegend}</legend>
              {target.topics.map((topic) => (
                <label key={topic} className="inline-flex min-h-[44px] cursor-pointer items-center gap-3 font-sans text-[16px] text-ink">
                  <input
                    type="checkbox"
                    checked={chosen.includes(topic)}
                    onChange={(event) => toggle(topic, event.target.checked)}
                    className="h-5 w-5 shrink-0 accent-[var(--accent)]"
                  />
                  {TOPIC_LABELS[topic]}
                </label>
              ))}
            </fieldset>
          </>
        ) : null}
      </DetailDrawer>
    </div>
  );
}
