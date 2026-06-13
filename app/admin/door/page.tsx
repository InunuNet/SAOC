'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import type { TicketType } from '@/types/index';

type CheckInResult =
  | {
      success: true;
      ticket: {
        attendeeName: string;
        ticketType: TicketType;
        bookingRef: string;
      };
    }
  | { success: false; error: string };

const SCANNER_ELEMENT_ID = 'qr-reader';

export default function DoorPage() {
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [manualRef, setManualRef] = useState('');
  const scanningRef = useRef<boolean>(false);

  async function handleCheckIn(bookingRef: string): Promise<void> {
    if (scanningRef.current) return;
    const trimmed = bookingRef.trim();
    if (!trimmed) return;

    scanningRef.current = true;
    try {
      const res = await fetch('/api/admin/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingRef: trimmed }),
      });
      const data = (await res.json()) as CheckInResult;
      setResult(data);
    } catch {
      setResult({ success: false, error: 'Network error — try again' });
    } finally {
      scanningRef.current = false;
    }
  }

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      SCANNER_ELEMENT_ID,
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false,
    );

    scanner.render(
      (decodedText) => {
        void handleCheckIn(decodedText);
      },
      undefined,
    );

    return () => {
      scanner.clear().catch(() => undefined);
    };
  }, []);

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    void handleCheckIn(manualRef);
    setManualRef('');
  }

  return (
    <div
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: '1rem',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Door Check-in</h1>

      <div id={SCANNER_ELEMENT_ID} style={{ marginBottom: '1.5rem' }} />

      <form onSubmit={handleManualSubmit} style={{ marginBottom: '1.5rem' }}>
        <label
          htmlFor="manual-ref"
          style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}
        >
          Manual entry
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            id="manual-ref"
            type="text"
            value={manualRef}
            onChange={(e) => setManualRef(e.target.value)}
            placeholder="Booking reference"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleCheckIn(manualRef);
                setManualRef('');
              }
            }}
            style={{
              flex: 1,
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: 4,
              fontSize: '1rem',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '0.5rem 1rem',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Check In
          </button>
        </div>
      </form>

      {result && (
        <div
          role="status"
          style={{
            padding: '1rem',
            borderRadius: 6,
            background: result.success ? '#dcfce7' : '#fee2e2',
            color: result.success ? '#166534' : '#991b1b',
            fontWeight: 600,
          }}
        >
          {result.success ? (
            <>
              <div>Checked in</div>
              <div>{result.ticket.attendeeName}</div>
              <div style={{ fontWeight: 400, fontSize: '0.875rem' }}>
                {result.ticket.ticketType} — {result.ticket.bookingRef}
              </div>
            </>
          ) : (
            <div>{result.error}</div>
          )}
        </div>
      )}
    </div>
  );
}
