'use client';

import { useState } from 'react';

import type { VendorSubmission, VendorSubmissionStatus } from '@/types/index';
import type { VendorReviewAction } from '@/lib/vendor-review';

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
}

export function VendorReviewTable({ submissions }: VendorReviewTableProps) {
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
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const actions = AVAILABLE_ACTIONS[row.status] ?? [];
              const style = STATUS_STYLES[row.status] ?? 'bg-bone text-muted border border-rule';

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
