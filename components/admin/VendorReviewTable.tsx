'use client';

import { useState } from 'react';

import type { VendorSubmission, VendorSubmissionStatus, VendorStandOrderStatus } from '@/types/index';
import type { VendorReviewAction } from '@/lib/vendor-review';

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

const STAND_PAYMENT_STYLES: Record<VendorStandOrderStatus | 'not-started', string> = {
  'not-started': 'bg-bone text-muted border border-rule',
  pending: 'bg-primary-100 text-primary-800',
  paid: 'bg-primary text-ivory',
  failed: 'bg-ivory text-muted border border-rule',
  cancelled: 'bg-ivory text-muted border border-rule',
};

const HEADER_CELL_CLASS =
  'whitespace-nowrap border-b border-rule bg-bone px-4 py-3 text-left font-mono text-[11px] tracking-[0.16em] text-muted';
const BODY_CELL_CLASS =
  'whitespace-nowrap border-b border-rule-soft px-4 py-3 font-sans text-[14px] text-ink';

const STATUS_STYLES: Record<string, string> = {
  submitted: 'bg-bone text-muted border border-rule',
  'under-review': 'bg-primary-100 text-primary-800',
  approved: 'bg-primary text-ivory',
  rejected: 'bg-ivory text-muted border border-rule line-through',
};

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

  async function handleAction(id: string, action: VendorReviewAction) {
    setPendingId(id);
    setError(null);

    try {
      const res = await fetch(`/api/admin/vendors/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const body = (await res.json()) as { success?: boolean; status?: string; error?: string };

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

  if (rows.length === 0) {
    return (
      <div className="border border-rule bg-ivory px-6 py-16 text-center">
        <p className="font-sans text-[15px] text-muted">No vendor applications have been submitted yet.</p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <p className="mb-4 border border-rule bg-ivory px-4 py-3 font-sans text-[14px] text-ink" role="alert">
          {error}
        </p>
      )}
      <div className="overflow-x-auto border border-rule bg-ivory">
        <table className="w-full min-w-[840px] border-collapse">
          <caption className="sr-only">Vendor application review status</caption>
          <thead>
            <tr>
              <th scope="col" className={HEADER_CELL_CLASS}>
                Business Name
              </th>
              <th scope="col" className={HEADER_CELL_CLASS}>
                Contact
              </th>
              <th scope="col" className={HEADER_CELL_CLASS}>
                Category
              </th>
              <th scope="col" className={HEADER_CELL_CLASS}>
                Permits &amp; Certificates
              </th>
              <th scope="col" className={HEADER_CELL_CLASS}>
                Status
              </th>
              <th scope="col" className={HEADER_CELL_CLASS}>
                Stand Payment
              </th>
              <th scope="col" className={HEADER_CELL_CLASS}>
                Marketing Uploads
              </th>
              <th scope="col" className={HEADER_CELL_CLASS}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const actions = AVAILABLE_ACTIONS[row.status] ?? [];
              const style = STATUS_STYLES[row.status] ?? 'bg-bone text-muted border border-rule';
              const standPaymentStatus = standPaymentStatusById[row.id] ?? 'not-started';
              const uploadedProductPhotoCount = countUploadedProductPhotos(row);
              const uploadsComplete = uploadedProductPhotoCount >= REQUIRED_PRODUCT_PHOTO_COUNT;

              return (
                <tr key={row.id} className="hover:bg-parchment/60">
                  <th scope="row" className={`${BODY_CELL_CLASS} font-medium`}>
                    {row.businessName}
                  </th>
                  <td className={BODY_CELL_CLASS}>
                    {row.contactPersonName}
                    <br />
                    <span className="text-muted">{row.contactEmail}</span>
                  </td>
                  <td className={BODY_CELL_CLASS}>{row.vendorCategory.join(', ')}</td>
                  <td className={`${BODY_CELL_CLASS} whitespace-normal align-top`}>
                    <dl className="space-y-1">
                      <div>
                        <dt className="inline text-muted">Phytosanitary/import permit: </dt>
                        <dd className="inline">{row.phytosanitaryPermitNumber || '—'}</dd>
                      </div>
                      <div>
                        <dt className="inline text-muted">CITES permit: </dt>
                        <dd className="inline">{row.citesPermitNumber || '—'}</dd>
                      </div>
                      <div>
                        <dt className="inline text-muted">Food-handling certificate: </dt>
                        <dd className="inline">{row.foodHandlingCertificateNumber || '—'}</dd>
                      </div>
                    </dl>
                    <p className="mt-1 text-[11px] text-muted">
                      Permit and certificate numbers are recorded as submitted and have not been verified by SAOC.
                    </p>
                  </td>
                  <td className={BODY_CELL_CLASS}>
                    <span
                      className={`inline-flex items-center rounded-pill px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.14em] ${style}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className={BODY_CELL_CLASS}>
                    <span
                      className={`inline-flex items-center rounded-pill px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.14em] ${STAND_PAYMENT_STYLES[standPaymentStatus]}`}
                    >
                      {STAND_PAYMENT_LABELS[standPaymentStatus]}
                    </span>
                  </td>
                  <td className={BODY_CELL_CLASS}>
                    <span
                      className={`inline-flex items-center rounded-pill px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.14em] ${
                        uploadsComplete
                          ? 'bg-primary text-ivory'
                          : 'bg-ivory text-muted border border-rule'
                      }`}
                    >
                      {uploadedProductPhotoCount}/{REQUIRED_PRODUCT_PHOTO_COUNT} photos
                    </span>
                    {!uploadsComplete && (
                      <p className="mt-1 text-[11px] text-muted">Incomplete — not yet all 3 required</p>
                    )}
                  </td>
                  <td className={BODY_CELL_CLASS}>
                    <div className="flex gap-2">
                      {actions.length === 0 && <span className="text-muted">—</span>}
                      {actions.map((action) => (
                        <button
                          key={action}
                          type="button"
                          disabled={pendingId === row.id}
                          onClick={() => handleAction(row.id, action)}
                          className="rounded-sm border border-rule bg-ivory px-3 py-1.5 font-sans text-[13px] font-medium text-ink transition-colors hover:bg-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {pendingId === row.id ? 'Saving…' : ACTION_LABELS[action]}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
