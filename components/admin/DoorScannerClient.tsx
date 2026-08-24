'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode, type CameraCapabilities } from 'html5-qrcode';

import { DoorResultBanner, type CheckInResult } from '@/components/admin/DoorResultBanner';

type TorchFeature = ReturnType<CameraCapabilities['torchFeature']>;

const SCANNER_ELEMENT_ID = 'qr-reader';
const SCAN_CONFIG = { fps: 10, qrbox: { width: 250, height: 250 } };
const SUCCESS_AUTO_DISMISS_MS = 3000;

// Camera lifecycle, surfaced to the volunteer instead of a blank box on failure.
type CameraStatus = 'starting' | 'running' | 'permission-denied' | 'no-camera' | 'error';

function classifyCameraError(error: unknown): CameraStatus {
  const text = String(error);
  if (text.includes('NotAllowedError') || text.includes('PermissionDeniedError')) {
    return 'permission-denied';
  }
  if (text.includes('NotFoundError') || text.includes('OverconstrainedError')) {
    return 'no-camera';
  }
  return 'error';
}

const CAMERA_STATUS_MESSAGE: Record<Exclude<CameraStatus, 'starting' | 'running'>, string> = {
  'permission-denied':
    'Camera access was denied. Allow camera access in your browser settings, or use manual entry below.',
  'no-camera': 'No camera was found on this device. Use manual entry below.',
  error: 'The camera could not be started. Use manual entry below.',
};

// Deliberately NOT wrapped in site chrome — a nav bar is an obstacle at a show entrance.
// Same fonts/tokens as the rest of the site, but tuned for one-handed, at-speed use in
// bright daylight: large touch targets, high contrast, minimal chrome. Extracted
// unchanged from app/admin/door/page.tsx (F1 admin-nav-menu) so app/admin/door/page.tsx
// could become an async Server Component capable of computing canReviewVendors for
// AdminNav's minimal variant.
export function DoorScannerClient() {
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [manualRef, setManualRef] = useState('');
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('starting');
  const [torchFeature, setTorchFeature] = useState<TorchFeature | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const scanningRef = useRef<boolean>(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearDismissTimer() {
    if (dismissTimerRef.current !== null) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }

  function applyResult(data: CheckInResult) {
    clearDismissTimer();
    setResult(data);
    if (data.success) {
      dismissTimerRef.current = setTimeout(() => {
        dismissTimerRef.current = null;
        setResult(null);
      }, SUCCESS_AUTO_DISMISS_MS);
    }
  }

  useEffect(() => {
    return () => clearDismissTimer();
  }, []);

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
      applyResult(data);
    } catch {
      applyResult({ success: false, error: 'Network error — try again' });
    } finally {
      scanningRef.current = false;
    }
  }

  // Constructs a scanner and starts it. All state updates here happen inside
  // start()'s async callbacks, never synchronously — safe to call from an effect.
  const beginScan = useCallback(() => {
    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, { verbose: false });
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        SCAN_CONFIG,
        (decodedText) => {
          void handleCheckIn(decodedText);
        },
        undefined, // per-frame "no QR found" noise — expected during normal scanning, not an error
      )
      .then(() => {
        setCameraStatus('running');
        const torch = scanner.getRunningTrackCameraCapabilities().torchFeature();
        if (torch.isSupported()) {
          setTorchFeature(torch);
        }
      })
      .catch((error: unknown) => {
        setCameraStatus(classifyCameraError(error));
      });
  }, []);

  useEffect(() => {
    beginScan();

    return () => {
      const scanner = scannerRef.current;
      if (!scanner) return;
      if (scanner.isScanning) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => undefined);
      } else {
        scanner.clear();
      }
    };
  }, [beginScan]);

  // Retry, triggered from the "Try camera again" button — an event handler, so
  // resetting state synchronously here (unlike in the mount effect) is safe.
  function retryCamera() {
    setCameraStatus('starting');
    setTorchFeature(null);
    setTorchOn(false);
    beginScan();
  }

  async function toggleTorch() {
    if (!torchFeature) return;
    const next = !torchOn;
    try {
      await torchFeature.apply(next);
      setTorchOn(next);
    } catch {
      setTorchFeature(null); // device claimed torch support but the call failed — stop offering it
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    void handleCheckIn(manualRef);
    setManualRef('');
  }

  const cameraFailed = cameraStatus !== 'starting' && cameraStatus !== 'running';

  return (
    <div className="flex h-dvh min-h-dvh flex-col overflow-hidden bg-parchment px-4 py-6">
      <div className="mx-auto flex min-h-0 w-full max-w-[480px] flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <span className="eyebrow">SAOC</span>
          <h1 className="mt-3 font-serif text-[26px] font-semibold leading-tight text-ink">
            Door Check-in
          </h1>

          <div className="mt-5 border border-rule bg-ivory p-4">
            <div id={SCANNER_ELEMENT_ID} />

            {cameraStatus === 'starting' && (
              <p className="mt-3 font-sans text-[15px] text-muted">Starting camera…</p>
            )}

            {cameraFailed && (
              <div className="mt-3 space-y-3">
                <p className="font-sans text-[15px] text-ink">
                  {CAMERA_STATUS_MESSAGE[cameraStatus]}
                </p>
                <button
                  type="button"
                  onClick={retryCamera}
                  className="w-full rounded-sm border border-rule bg-ivory px-4 py-3 font-sans text-[15px] font-semibold text-ink transition-colors hover:bg-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  Try camera again
                </button>
              </div>
            )}

            {cameraStatus === 'running' && torchFeature && (
              <button
                type="button"
                onClick={() => void toggleTorch()}
                aria-pressed={torchOn}
                className="mt-3 w-full rounded-sm border border-rule bg-ivory px-4 py-3 font-sans text-[15px] font-semibold text-ink transition-colors hover:bg-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {torchOn ? 'Turn off torch' : 'Turn on torch'}
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleManualSubmit} className="mt-5 flex-none space-y-2">
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
          <DoorResultBanner
            result={result}
            onDismiss={() => {
              clearDismissTimer();
              setResult(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
