'use client';

import { useEffect, useState } from 'react';

import type { ShippedDesign } from '@/lib/ticket-design/schema';

const EMAIL_ENDPOINT = '/api/admin/studio/preview-email';
const PDF_ENDPOINT = '/api/admin/studio/preview-pdf';
export const PREVIEW_DEBOUNCE_MS = 400;

export interface StudioPreviews {
  emailHtml: string | null;
  emailError: string | null;
  pdfUrl: string | null;
  pdfError: string | null;
}

async function post(url: string, design: ShippedDesign, signal: AbortSignal): Promise<Response> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ design }),
    signal,
  });
  if (!res.ok) throw new Error(`Preview failed (${res.status})`);
  return res;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** Re-renders both previews 400 ms after the last change; a newer change aborts the older request. */
export function usePreviews(design: ShippedDesign): StudioPreviews {
  const [previews, setPreviews] = useState<StudioPreviews>({
    emailHtml: null,
    emailError: null,
    pdfUrl: null,
    pdfError: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      post(EMAIL_ENDPOINT, design, controller.signal)
        .then((res) => res.json() as Promise<{ html: string }>)
        .then((body) => setPreviews((prev) => ({ ...prev, emailHtml: body.html, emailError: null })))
        .catch((error: unknown) => {
          if (!isAbort(error)) setPreviews((prev) => ({ ...prev, emailError: 'Email preview failed' }));
        });
      post(PDF_ENDPOINT, design, controller.signal)
        .then((res) => res.blob())
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          setPreviews((prev) => {
            if (prev.pdfUrl) URL.revokeObjectURL(prev.pdfUrl);
            return { ...prev, pdfUrl: url, pdfError: null };
          });
        })
        .catch((error: unknown) => {
          if (!isAbort(error)) setPreviews((prev) => ({ ...prev, pdfError: 'PDF preview failed' }));
        });
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [design]);

  return previews;
}
