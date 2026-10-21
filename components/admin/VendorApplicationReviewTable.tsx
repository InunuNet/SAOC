'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { VendorApplication, VendorApplicationStatus } from '@/types/index';
import type { VendorApplicationReviewAction } from '@/lib/vendor-application-review';
import { formatAdminDate, formatAdminDateTime } from '@/lib/admin-format';
import { DetailDrawer, DetailSection } from './DetailDrawer';
import { StatusPill } from './StatusPill';
import { AdminTable } from './table/AdminTable';
import { APPLICATION_COLUMNS } from './table/columns';
import { TableToolbar, type FilterOption } from './table/TableToolbar';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, FOCUS_RING } from './tokens';
import { useDrawerParam } from './useDrawerParam';

// Mirrors components/admin/VendorReviewTable.tsx's structure exactly (mission
// vendor-gated-registration-flow F5) -- same fetch-then-optimistic-patch action handler shape,
// adapted to VendorApplication's smaller field set and pending/approved/declined machine.
// Mission admin-redesign F1: rows are server-ordered newest first and never re-sorted here;
// the record's actions moved from the row into the detail drawer's sticky footer.

// A pending application offers both actions; approved/declined are terminal in
// lib/vendor-application-review.ts's closed transition machine and offer none.
const AVAILABLE_ACTIONS: Record<string, VendorApplicationReviewAction[]> = {
  pending: ['approve', 'decline'],
};

const ACTION_LABELS: Record<VendorApplicationReviewAction, string> = {
  approve: 'Approve',
  decline: 'Decline',
};

type StatusFilter = 'all' | VendorApplicationStatus;

const STATUS_OPTIONS: readonly FilterOption[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'declined', label: 'Declined' },
];

const EMPTY_TEXT = 'No vendor applications have been submitted yet.';
const NOT_PROVIDED = '—';

interface VendorApplicationReviewTableProps {
  applications: VendorApplication[];
}

function matchesSearch(row: VendorApplication, needle: string): boolean {
  return [row.businessName, row.contactPersonName, row.contactEmail, row.vendorCategory.join(' ')].some(
    (value) => value.toLowerCase().includes(needle),
  );
}

export function VendorApplicationReviewTable({ applications }: VendorApplicationReviewTableProps) {
  const [rows, setRows] = useState(applications);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const router = useRouter();
  const { viewId, open, close } = useDrawerParam();

  // Newest first comes from the server. Land on what needs a decision; with nothing pending,
  // show everything rather than an empty list.
  const defaultStatus: StatusFilter = rows.some((row) => row.status === 'pending') ? 'pending' : 'all';
  const [status, setStatus] = useState<StatusFilter>(defaultStatus);
  const [search, setSearch] = useState('');

  // A failed action sets `error`; scroll its banner into view so a failure is never silent.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: 'nearest' });
  }, [error]);

  async function handleAction(id: string, action: VendorApplicationReviewAction) {
    setPendingId(id);
    setError(null);

    try {
      const res = await fetch(`/api/admin/vendors/applications/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      // A non-JSON body (e.g. a plain-text 401 from the beta wall) must fall through to the
      // !res.ok branch below rather than throw into the "reach the server" catch.
      const parsed: unknown = await res.json().catch(() => null);
      // A JSON `null` (or any non-object) counts as no body.
      const body = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as {
        success?: boolean;
        status?: string;
        error?: string;
      };

      if (!res.ok || !body.success || !body.status) {
        setError(body.error ?? 'Failed to update vendor application.');
        return;
      }

      const nextStatus = body.status as VendorApplicationStatus;
      setRows((current) =>
        current.map((row) => (row.id === id ? { ...row, status: nextStatus } : row)),
      );
      // The sidebar's pending badge is server-rendered in the shell layout.
      router.refresh();
    } catch {
      setError('Failed to reach the server. Please try again.');
    } finally {
      setPendingId(null);
    }
  }

  // F25 (vendor-gated-registration-flow, M4) -- ONE operator action covers both "vendor is
  // locked out" and "vendor lost the email"; there is deliberately no separate unlock action.
  // See contracts/golden/vendor-gated-registration-flow-m4/README.md's "Reissue, not unlock".
  async function handleReissueCode(id: string) {
    setPendingId(id);
    setError(null);

    try {
      const res = await fetch(`/api/admin/vendors/applications/${id}/reissue-code`, {
        method: 'POST',
      });

      const body = (await res.json()) as { success?: boolean; registrationCodeId?: string; error?: string };

      if (!res.ok || !body.success || !body.registrationCodeId) {
        setError(body.error ?? 'Failed to reissue a registration code.');
        return;
      }

      const nextCodeId = body.registrationCodeId;
      setRows((current) =>
        current.map((row) =>
          row.id === id
            ? { ...row, registrationCodeId: nextCodeId, registrationCodeLockedAt: null }
            : row,
        ),
      );
    } catch {
      setError('Failed to reach the server. Please try again.');
    } finally {
      setPendingId(null);
    }
  }

  const needle = search.trim().toLowerCase();
  const visible = rows.filter(
    (row) => (status === 'all' || row.status === status) && (!needle || matchesSearch(row, needle)),
  );
  const selected = viewId ? (rows.find((row) => row.id === viewId) ?? null) : null;

  const errorBanner = error ? (
    <p
      ref={errorRef}
      className="mb-4 border border-rule bg-ivory px-4 py-3 font-sans text-[14px] text-ink"
      role="alert"
    >
      {error}
    </p>
  ) : null;

  function renderCell(columnId: string, row: VendorApplication): React.ReactNode {
    switch (columnId) {
      case 'business':
        return (
          <>
            <span className="block truncate font-medium">{row.businessName}</span>
            <span className="block truncate text-[13px] text-muted">
              {row.contactPersonName} · {row.contactEmail}
            </span>
          </>
        );
      case 'category':
        return row.vendorCategory.join(', ');
      case 'stands':
        return row.indicativeBoothCount;
      case 'submitted':
        return formatAdminDate(row.submittedAt);
      case 'status':
        return <StatusPill status={row.status} />;
      case 'view':
        return (
          <button
            type="button"
            onClick={() => open(row.id)}
            aria-label={`View ${row.businessName}`}
            className={`min-h-[44px] px-2 font-sans text-[14px] font-semibold text-primary underline decoration-accent underline-offset-4 hover:text-primary-800 ${FOCUS_RING}`}
          >
            View
          </button>
        );
      default:
        return null;
    }
  }

  function cellTitle(columnId: string, row: VendorApplication): string | undefined {
    switch (columnId) {
      case 'business':
        return `${row.businessName} — ${row.contactPersonName}, ${row.contactEmail}`;
      case 'category':
        return row.vendorCategory.join(', ');
      case 'submitted':
        return formatAdminDateTime(row.submittedAt);
      default:
        return undefined;
    }
  }

  const actions = selected ? (AVAILABLE_ACTIONS[selected.status] ?? []) : [];

  return (
    <div>
      <TableToolbar
        searchLabel="Search applications"
        search={search}
        onSearchChange={setSearch}
        filterLabel="Application status"
        filterOptions={STATUS_OPTIONS}
        filterValue={status}
        onFilterChange={(value) => setStatus(value as StatusFilter)}
        countText={`${visible.length} ${visible.length === 1 ? 'application' : 'applications'}`}
      />
      {selected ? null : errorBanner}
      <AdminTable
        caption="Vendor application review status"
        columns={APPLICATION_COLUMNS}
        rows={visible}
        getRowId={(row) => row.id}
        renderCell={renderCell}
        cellTitle={cellTitle}
        onOpen={(row) => open(row.id)}
        emptyText={EMPTY_TEXT}
        card={(row) => ({
          title: row.businessName,
          status: <StatusPill status={row.status} />,
          fields: [
            { label: 'Contact', value: row.contactPersonName },
            { label: 'Stand', value: String(row.indicativeBoothCount) },
            { label: 'Submitted', value: formatAdminDate(row.submittedAt) },
          ],
        })}
      />

      <DetailDrawer
        open={selected !== null}
        title={selected?.businessName ?? ''}
        subtitle={selected ? selected.contactEmail : undefined}
        onClose={close}
        footer={
          selected ? (
            <div>
              {errorBanner}
              <div className="flex flex-wrap gap-3">
                {actions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    disabled={pendingId === selected.id}
                    onClick={() => handleAction(selected.id, action)}
                    className={action === 'approve' ? BUTTON_PRIMARY : BUTTON_SECONDARY}
                  >
                    {pendingId === selected.id ? 'Saving…' : ACTION_LABELS[action]}
                  </button>
                ))}
                {selected.status === 'approved' ? (
                  <button
                    type="button"
                    disabled={pendingId === selected.id}
                    onClick={() => handleReissueCode(selected.id)}
                    className={BUTTON_SECONDARY}
                  >
                    {pendingId === selected.id ? 'Saving…' : 'Reissue code'}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null
        }
      >
        {selected ? (
          <>
            <DetailSection
              title="Business"
              items={[
                { label: 'Business name', value: selected.businessName },
                { label: 'Trading name', value: selected.tradingName || NOT_PROVIDED },
                { label: 'Category', value: selected.vendorCategory.join(', ') },
                { label: 'Status', value: <StatusPill status={selected.status} /> },
                { label: 'Submitted', value: formatAdminDateTime(selected.submittedAt) },
              ]}
            />
            <DetailSection
              title="Contact"
              items={[
                { label: 'Contact person', value: selected.contactPersonName },
                { label: 'Email', value: selected.contactEmail },
                { label: 'Cell phone', value: selected.contactCellPhone },
              ]}
            />
            <DetailSection
              title="Stand"
              items={[
                { label: 'Indicative stands', value: selected.indicativeBoothCount },
                {
                  label: 'Registration code',
                  value:
                    selected.status === 'approved' ? (
                      <span className="font-mono text-[13px] tracking-[0.08em]">
                        {selected.registrationCodeId ?? NOT_PROVIDED}
                        {selected.registrationCodeLockedAt ? (
                          <span className="ml-2 inline-flex items-center rounded-full border border-primary-800 bg-bone px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-primary-800">
                            Locked
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      NOT_PROVIDED
                    ),
                },
              ]}
            />
          </>
        ) : null}
      </DetailDrawer>
    </div>
  );
}
