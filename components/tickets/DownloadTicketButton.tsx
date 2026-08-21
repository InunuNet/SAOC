'use client';

import { useCallback, useState } from 'react';

// F1 (confirmation-page-qr-and-download) — client-side Canvas-composited PNG "ticket card"
// download. Deliberately not a PDF (see the golden's "Download format decision" — no new
// dependency, matches the real use case of a phone pulled up at the door). The QR itself is the
// SAME data URI the Server Component already rendered as an <img> — this component composites
// it, plus attendee/ticket text, onto an offscreen canvas and saves the flattened result.
//
// Quiet-zone requirement (golden, non-negotiable): at least 16px of clear space on every side of
// the QR, nothing drawn over it, so a downloaded ticket stays independently re-scannable — this
// project's A6 assertion decodes the downloaded file with jsqr to prove it.
const CANVAS_WIDTH = 480;
const QR_SIZE = 320;
const QR_MARGIN = 32; // > the 16px minimum quiet zone, applied on every side of the QR.
const TEXT_TOP_PADDING = 28;
const LINE_HEIGHT = 26;

interface DownloadTicketButtonProps {
  bookingRef: string;
  attendeeName: string;
  ticketType: string;
  qrDataUri: string;
  label: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load QR image for ticket download'));
    image.src = src;
  });
}

export function DownloadTicketButton({
  bookingRef,
  attendeeName,
  ticketType,
  qrDataUri,
  label,
}: DownloadTicketButtonProps) {
  const [status, setStatus] = useState<'idle' | 'preparing' | 'error'>('idle');

  const handleDownload = useCallback(async () => {
    setStatus('preparing');
    try {
      const qrImage = await loadImage(qrDataUri);

      const canvasHeight = QR_MARGIN * 2 + QR_SIZE + TEXT_TOP_PADDING + LINE_HEIGHT * 3;
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas 2D context unavailable');
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const qrX = (CANVAS_WIDTH - QR_SIZE) / 2;
      const qrY = QR_MARGIN;
      ctx.drawImage(qrImage, qrX, qrY, QR_SIZE, QR_SIZE);

      ctx.fillStyle = '#1a1a1a';
      ctx.textAlign = 'center';
      let textY = qrY + QR_SIZE + TEXT_TOP_PADDING;

      ctx.font = '600 18px sans-serif';
      ctx.fillText(attendeeName, CANVAS_WIDTH / 2, textY);
      textY += LINE_HEIGHT;

      ctx.font = '15px sans-serif';
      ctx.fillText(ticketType, CANVAS_WIDTH / 2, textY);
      textY += LINE_HEIGHT;

      ctx.font = '13px monospace';
      ctx.fillText(bookingRef, CANVAS_WIDTH / 2, textY);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) {
        throw new Error('Canvas failed to produce a PNG blob');
      }

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `saoc-ticket-${bookingRef}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);

      setStatus('idle');
    } catch (error) {
      console.error('[DownloadTicketButton] Failed to prepare ticket download:', error);
      setStatus('error');
    }
  }, [bookingRef, attendeeName, ticketType, qrDataUri]);

  return (
    <div>
      <button
        type="button"
        onClick={handleDownload}
        disabled={status === 'preparing'}
        aria-label={`Download ticket for ${attendeeName} as an image`}
        className="rounded-sm bg-accent px-5 py-2.5 font-sans text-[14px] font-medium text-ivory transition-colors hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === 'preparing' ? 'Preparing download…' : label}
      </button>
      {status === 'error' ? (
        <p role="alert" className="mt-2 font-sans text-[13px] text-accent">
          Couldn&apos;t prepare the download. Please try again, or use the QR code above.
        </p>
      ) : null}
    </div>
  );
}
