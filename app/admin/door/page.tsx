'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

import { DoorResultBanner, type CheckInResult } from '@/components/admin/DoorResultBanner';

const SCANNER_ELEMENT_ID = 'qr-reader';

// Deliberately NOT wrapped in site chrome — a nav bar is an obstacle at a show entrance.
// Same fonts/tokens as the rest of the site, but tuned for one-handed, at-speed use in
// bright daylight: large touch targets, high contrast, minimal chrome.
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

    scanner.render((decodedText) => {
      void handleCheckIn(decodedText);
    }, undefined);

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
    <div className="min-h-screen bg-parchment px-4 py-6">
      <div className="mx-auto max-w-[480px]">
        <span className="eyebrow">SAOC</span>
        <h1 className="mt-3 font-serif text-[26px] font-semibold leading-tight text-ink">
          Door Check-in
        </h1>

        <div id={SCANNER_ELEMENT_ID} className="mt-5 border border-rule bg-ivory p-2" />

        <form onSubmit={handleManualSubmit} className="mt-5 space-y-2">
          <label
            htmlFor="manual-ref"
            className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted"
          >
            Manual entry
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="manual-ref"
              type="text"
              value={manualRef}
              onChange={(e) => setManualRef(e.target.value)}
              placeholder="Booking reference"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-sm border border-rule bg-ivory px-4 py-4 font-sans text-[18px] text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-primary/40"
            />
            <button
              type="submit"
              className="rounded-sm bg-primary px-6 py-4 font-sans text-[18px] font-bold text-ivory transition-colors active:bg-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
            >
              Check In
            </button>
          </div>
        </form>

        {result && (
          <div className="mt-5">
            <DoorResultBanner result={result} />
          </div>
        )}
      </div>
    </div>
  );
}
