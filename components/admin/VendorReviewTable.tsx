'use client';

import { useEffect, useRef, useState } from 'react';

import type { VendorSubmission, VendorSubmissionStatus, VendorStandOrderStatus } from '@/types/index';
import type { VendorReviewAction } from '@/lib/vendor-review';
import { isVendorListingEligible } from '@/lib/vendor-listing';
import { formatAdminDate, formatAdminDateTime } from '@/lib/admin-format';
import { DetailDrawer, DetailSection } from './DetailDrawer';
import { StatusPill } from './StatusPill';
import { AdminTable } from './table/AdminTable';
import { VENDOR_COLUMNS } from './table/columns';
import { TableToolbar, type FilterOption } from './table/TableToolbar';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, FOCUS_RING } from './tokens';
import { useDrawerParam } from './useDrawerParam';
import { VendorPaymentLinkControl } from './VendorPaymentLinkControl';
import { VendorPhotoLinkControl } from './VendorPhotoLinkControl';

// F32 (vendor-gated-registration-flow, M3) — read-only display labels only. This is NOT the
// office-use `paymentReceived` (F7/EFT) signal, which the table renders separately below, so
// an operator never conflates "gateway-paid" with "office-confirmed manually".
const STAND_PAYMENT_LABELS: Record<VendorStandOrderStatus | 'not-started', string> = {
  'not-started': 'Not started',
  pending: 'Pending',
  paid: 'Paid',
  failed: 'Failed',
  cancelled: 'Failed',
};

// Stand-payment pill tones reuse StatusPill's existing styles: in-flight reads as "in progress",
// paid as "settled", anything else as neutral.
const STAND_PAYMENT_TONES: Record<VendorStandOrderStatus | 'not-started', string> = {
  'not-started': 'neutral',
  pending: 'under-review',
  paid: 'approved',
  failed: 'neutral',
  cancelled: 'neutral',
};

type StatusFilter = 'all' | VendorSubmissionStatus;

const STATUS_OPTIONS: readonly FilterOption[] = [
  { value: 'all', label: 'All' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under-review', label: 'Under review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const EMPTY_TEXT = 'No vendor applications have been submitted yet.';
const NOT_PROVIDED = '—';

function matchesSearch(row: VendorSubmission, needle: string): boolean {
  return [row.businessName, row.contactPersonName, row.contactEmail, row.vendorCategory.join(' ')].some(
    (value) => value.toLowerCase().includes(needle),
  );
}

// Which review action(s) are offered for a given current status. A submission at
// 'approved'/'rejected' offers none — it is a terminal state in
// lib/vendor-review.ts's closed transition machine.
const AVAILABLE_ACTIONS: Record<string, VendorReviewAction[]> = {
  submitted: ['start-review'],
  'under-review': ['approve', 'reject'],
};

const ACTION_LABELS: Record<VendorReviewAction, string> = {
  'start-review': 'Start review',
  approve: 'Approve',
  reject: 'Reject',
};

const LISTING_CONSENT_CONFIRM = "This vendor hasn't given permission to be listed. Publish anyway?";

interface VendorReviewTableProps {
  submissions: VendorSubmission[];
  /** F32 — keyed by vendorSubmissionId; a submission absent from this map is "not started". */
  standPaymentStatusById?: Record<string, VendorStandOrderStatus>;
}

// @qa finding, 2026-09-01 (M2 fix pass): the source doc requires exactly 3 product photos
// (VendorRegisterSuccess.tsx's own success-page copy now says so), but nothing in the review
// UI told the committee whether a submission's uploads were actually complete before they
// approve it. Minimal surface: count how many of the 3 required product photo slots are
// filled and flag anything short of 3 -- logo is optional per the source doc, so it is not
// part of this count.
const REQUIRED_PRODUCT_PHOTO_COUNT = 3;

function countUploadedProductPhotos(row: VendorSubmission): number {
  return [row.productPhoto1Path, row.productPhoto2Path, row.productPhoto3Path].filter(
    (path): path is string => typeof path === 'string' && path.length > 0,
  ).length;
}

export function VendorReviewTable({ submissions, standPaymentStatusById = {} }: VendorReviewTableProps) {
  const [rows, setRows] = useState(submissions);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  // Hotfix (contracts/golden/vendor-stand-payment-link-visibility) -- fetched links, keyed by
  // vendorSubmissionId, so the manual-copy fallback stays visible after a successful fetch.
  const [paymentUrlById, setPaymentUrlById] = useState<Record<string, string>>({});
  // Photo-resume links (vendor-flow-fixes F2), keyed by vendorSubmissionId, same fallback role.
  const [photoUrlById, setPhotoUrlById] = useState<Record<string, string>>({});
  // F30 -- per-row result of the last Publish to listing click ('Published' / 'Already listed').
  const [listingStateById, setListingStateById] = useState<Record<string, string>>({});

  // A failed action sets `error`; scroll its banner into view so a failure is never silent
  // when the row that was clicked sits far below it.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: 'nearest' });
  }, [error]);

  // Hotfix (contracts/golden/vendor-stand-payment-link-visibility, 2026-09-01) -- reuses the
  // same pendingId/error state as handleAction above (no second loading/error mechanism). The
  // route ALWAYS mints a fresh token per call ("reissue, not unlock"), so re-clicking after a
  // successful fetch is expected and re-copies a new, still-valid link.
  async function handleResendPaymentLink(id: string) {
    setPendingId(id);
    setError(null);

    try {
      const res = await fetch(`/api/admin/vendors/${id}/resend-payment-link`, { method: 'POST' });
      const body = (await res.json()) as { success?: boolean; paymentUrl?: string; error?: string };

      if (!res.ok || !body.success || !body.paymentUrl) {
        setError(body.error ?? 'Failed to generate the payment link.');
        return;
      }

      const paymentUrl = body.paymentUrl;
      setPaymentUrlById((current) => ({ ...current, [id]: paymentUrl }));

      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(paymentUrl);
        } catch {
          // Clipboard write blocked (permissions, insecure context, etc.) -- the URL stays
          // visible inline as a manual-copy fallback, so this is not an error state.
        }
      }
    } catch {
      setError('Failed to reach the server. Please try again.');
    } finally {
      setPendingId(null);
    }
  }

  // Same pendingId/error state and copy-with-visible-fallback behaviour as the payment link.
  // The route ALWAYS mints a fresh link and sends no email.
  async function handleGetPhotoLink(id: string) {
    setPendingId(id);
    setError(null);

    try {
      const res = await fetch(`/api/admin/vendors/${id}/resend-photo-link`, { method: 'POST' });
      const body = (await res.json()) as { success?: boolean; photoUrl?: string; error?: string };

      if (!res.ok || !body.success || !body.photoUrl) {
        setError(body.error ?? 'Failed to generate the photo upload link.');
        return;
      }

      const photoUrl = body.photoUrl;
      setPhotoUrlById((current) => ({ ...current, [id]: photoUrl }));

      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(photoUrl);
        } catch {
          // Clipboard write blocked -- the URL stays visible inline as a manual-copy fallback.
        }
      }
    } catch {
      setError('Failed to reach the server. Please try again.');
    } finally {
      setPendingId(null);
    }
  }

  // F30 -- publishes the allowlisted projection to the public listing. A 'consent-missing'
  // refusal asks for explicit confirmation and retries once with acknowledgeNoConsent.
  async function handlePublishListing(id: string, acknowledgeNoConsent = false) {
    setPendingId(id);
    setError(null);

    try {
      const res = await fetch(`/api/admin/vendors/${id}/publish-listing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledgeNoConsent }),
      });
      const body = (await res.json()) as {
        success?: boolean;
        outcome?: 'created' | 'already-listed';
        reason?: string;
        error?: string;
      };

      if (res.status === 409 && body.reason === 'consent-missing' && !acknowledgeNoConsent) {
        if (window.confirm(LISTING_CONSENT_CONFIRM)) {
          await handlePublishListing(id, true);
        }
        return;
      }

      if (!res.ok || !body.success) {
        setError(body.error ?? 'Publish failed');
        return;
      }

      setListingStateById((current) => ({
        ...current,
        [id]: body.outcome === 'already-listed' ? 'Already listed' : 'Published',
      }));
    } catch {
      setError('Publish failed');
    } finally {
      setPendingId(null);
    }
  }

  async function handleAction(id: string, action: VendorReviewAction) {
    setPendingId(id);
    setError(null);

    try {
      const res = await fetch(`/api/admin/vendors/${id}/review`, {
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
        setError(body.error ?? 'Failed to update vendor submission.');
        return;
      }

      const nextStatus = body.status as VendorSubmissionStatus;
      setRows((current) =>
        current.map((row) => (row.id === id ? { ...row, status: nextStatus } : row)),
      );
    } catch {
      setError('Failed to reach the server. Please try again.');
    } finally {
      setPendingId(null);
    }
  }

  const { viewId, open, close } = useDrawerParam();
  const [status, setStatus] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');

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

  function standPaymentOf(id: string): VendorStandOrderStatus | 'not-started' {
    return standPaymentStatusById[id] ?? 'not-started';
  }

  function renderCell(columnId: string, row: VendorSubmission): React.ReactNode {
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
      case 'submitted':
        return formatAdminDate(row.submittedAt);
      case 'status':
        return <StatusPill status={row.status} />;
      case 'standPayment': {
        const payment = standPaymentOf(row.id);
        return <StatusPill status={payment} label={STAND_PAYMENT_LABELS[payment]} tone={STAND_PAYMENT_TONES[payment]} />;
      }
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

  function cellTitle(columnId: string, row: VendorSubmission): string | undefined {
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

  function renderFooter(row: VendorSubmission): React.ReactNode {
    const actions = AVAILABLE_ACTIONS[row.status] ?? [];
    const standPaymentStatus = standPaymentOf(row.id);
    const uploadedProductPhotoCount = countUploadedProductPhotos(row);
    const showPhotoLink =
      uploadedProductPhotoCount < REQUIRED_PRODUCT_PHOTO_COUNT && row.status !== 'rejected';
    const listingState = listingStateById[row.id] ?? (row.listingDocumentId ? 'Published' : null);
    const showPublishListing = isVendorListingEligible({
      status: row.status,
      paymentReceived: row.paymentReceived,
      standOrderStatus: standPaymentStatusById[row.id] ?? null,
    });
    const busy = pendingId === row.id;
    const hasAnyAction =
      actions.length > 0 ||
      (row.status === 'approved' && standPaymentStatus !== 'paid') ||
      showPhotoLink ||
      showPublishListing;

    return (
      <div>
        {errorBanner}
        <div className="flex flex-wrap items-start gap-3">
          {!hasAnyAction ? <span className="text-muted">—</span> : null}
          {actions.map((action) => (
            <button
              key={action}
              type="button"
              disabled={busy}
              onClick={() => handleAction(row.id, action)}
              className={action === 'reject' ? BUTTON_SECONDARY : BUTTON_PRIMARY}
            >
              {busy ? 'Saving…' : ACTION_LABELS[action]}
            </button>
          ))}
          {row.status === 'approved' && standPaymentStatus !== 'paid' && (
            <VendorPaymentLinkControl
              isPending={busy}
              paymentUrl={paymentUrlById[row.id] ?? null}
              onRequestLink={() => handleResendPaymentLink(row.id)}
            />
          )}
          {showPublishListing &&
            (listingState ? (
              <span className="text-muted">{listingState}</span>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => handlePublishListing(row.id)}
                className={BUTTON_SECONDARY}
              >
                {busy ? 'Saving…' : 'Publish to listing'}
              </button>
            ))}
          {showPhotoLink && (
            <VendorPhotoLinkControl
              isPending={busy}
              photoUrl={photoUrlById[row.id] ?? null}
              onRequestLink={() => handleGetPhotoLink(row.id)}
            />
          )}
        </div>
      </div>
    );
  }

  function renderDetail(row: VendorSubmission): React.ReactNode {
    const payment = standPaymentOf(row.id);
    const photoCount = countUploadedProductPhotos(row);
    const photosComplete = photoCount >= REQUIRED_PRODUCT_PHOTO_COUNT;

    return (
      <>
        <DetailSection
          title="Business"
          items={[
            { label: 'Business name', value: row.businessName },
            { label: 'Trading name', value: row.tradingName || NOT_PROVIDED },
            { label: 'Category', value: row.vendorCategory.join(', ') },
            { label: 'Status', value: <StatusPill status={row.status} /> },
            { label: 'Submitted', value: formatAdminDateTime(row.submittedAt) },
          ]}
        />
        <DetailSection
          title="Contact"
          items={[
            { label: 'Contact person', value: row.contactPersonName },
            { label: 'Email', value: row.contactEmail },
            { label: 'Cell phone', value: row.contactCellPhone },
            { label: 'Emergency contact', value: row.emergencyContactName || NOT_PROVIDED },
            { label: 'Emergency phone', value: row.emergencyContactCellPhone || NOT_PROVIDED },
          ]}
        />
        <DetailSection
          title="Stand"
          items={[
            { label: 'Booth size', value: row.boothSize ?? row.boothCount ?? NOT_PROVIDED },
            { label: 'Booth number', value: row.boothNumber || NOT_PROVIDED },
          ]}
        />
        <DetailSection
          title="Permits"
          items={[
            { label: 'Phytosanitary / import permit', value: row.phytosanitaryPermitNumber || NOT_PROVIDED },
            { label: 'CITES permit', value: row.citesPermitNumber || NOT_PROVIDED },
            { label: 'Food-handling certificate', value: row.foodHandlingCertificateNumber || NOT_PROVIDED },
            {
              label: 'Note',
              value: (
                <span className="text-[12px] text-muted">
                  Permit and certificate numbers are recorded as submitted and have not been verified by SAOC.
                </span>
              ),
            },
          ]}
        />
        <DetailSection
          title="Payment"
          items={[
            {
              label: 'Stand payment',
              value: (
                <StatusPill status={payment} label={STAND_PAYMENT_LABELS[payment]} tone={STAND_PAYMENT_TONES[payment]} />
              ),
            },
            { label: 'Office payment', value: row.paymentReceived ? 'Received' : 'Not received' },
          ]}
        />
        <DetailSection
          title="Photos"
          items={[
            {
              label: 'Product photos',
              value: (
                <>
                  {photoCount}/{REQUIRED_PRODUCT_PHOTO_COUNT} photos
                  {!photosComplete && (
                    <span className="mt-1 block text-[12px] text-muted">Incomplete — not yet all 3 required</span>
                  )}
                </>
              ),
            },
            { label: 'Logo', value: row.logoPath ? 'Uploaded' : NOT_PROVIDED },
          ]}
        />
      </>
    );
  }

  return (
    <div>
      <TableToolbar
        searchLabel="Search vendors"
        search={search}
        onSearchChange={setSearch}
        filterLabel="Vendor status"
        filterOptions={STATUS_OPTIONS}
        filterValue={status}
        onFilterChange={(value) => setStatus(value as StatusFilter)}
        countText={`${visible.length} ${visible.length === 1 ? 'vendor' : 'vendors'}`}
      />
      {selected ? null : errorBanner}
      <AdminTable
        caption="Vendor application review status"
        columns={VENDOR_COLUMNS}
        rows={visible}
        getRowId={(row) => row.id}
        renderCell={renderCell}
        cellTitle={cellTitle}
        onOpen={(row) => open(row.id)}
        sortedDescColumnId="submitted"
        emptyText={EMPTY_TEXT}
        card={(row) => ({
          title: row.businessName,
          status: <StatusPill status={row.status} />,
          fields: [
            { label: 'Contact', value: row.contactPersonName },
            { label: 'Submitted', value: formatAdminDate(row.submittedAt) },
            { label: 'Stand payment', value: STAND_PAYMENT_LABELS[standPaymentOf(row.id)] },
          ],
        })}
      />

      <DetailDrawer
        open={selected !== null}
        title={selected?.businessName ?? ''}
        subtitle={selected ? selected.contactEmail : undefined}
        onClose={close}
        footer={selected ? renderFooter(selected) : null}
      >
        {selected ? renderDetail(selected) : null}
      </DetailDrawer>
    </div>
  );
}
