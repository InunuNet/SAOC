'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode, type CameraCapabilities } from 'html5-qrcode';

import { DoorResultBanner, type CheckInResult } from '@/components/admin/DoorResultBanner';
import { PageHeader, PageShell } from '@/components/admin/PageHeader';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, FOCUS_RING } from '@/components/admin/tokens';
import { useHydrated } from '@/lib/hooks/useHydrated';

type TorchFeature = ReturnType<CameraCapabilities['torchFeature']>;

const SCANNER_ELEMENT_ID = 'qr-reader';
const QR_BOX_RATIO = 0.7;
const SCAN_CONFIG = {
  fps: 10,
  aspectRatio: 1,
  qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
    const side = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * QR_BOX_RATIO);
    return { width: side, height: side };
  },
};
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

// Inside the admin shell, tuned for one-handed, at-speed use in bright daylight: a square
// camera, a result banner under it, a 48px manual field and a 56px "Scan next". Decoding
// pauses while a result is showing so a QR still in frame cannot overwrite a valid check-in
// with an "already used" a moment later; "Scan next" (or the success auto-dismiss) resumes it.
interface DoorScannerClientProps {
  /** Tickets already checked in when the page loaded; null hides the counter. */
  initialCheckedInCount: number | null;
}

export function DoorScannerClient({ initialCheckedInCount }: DoorScannerClientProps) {
  const hydrated = useHydrated();
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [manualRef, setManualRef] = useState('');
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('starting');
  const [torchFeature, setTorchFeature] = useState<TorchFeature | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [checkedInCount, setCheckedInCount] = useState(initialCheckedInCount);
  const scanningRef = useRef<boolean>(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualInputRef = useRef<HTMLInputElement | null>(null);

  function clearDismissTimer() {
    if (dismissTimerRef.current !== null) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }

  function pauseScanning() {
    try {
      scannerRef.current?.pause(false);
    } catch {
      // Not scanning (camera unavailable): nothing to pause.
    }
  }

  function resumeScanning() {
    try {
      scannerRef.current?.resume();
    } catch {
      // Not paused or not scanning: nothing to resume.
    }
  }

  function scanNext() {
    clearDismissTimer();
    setResult(null);
    resumeScanning();
    manualInputRef.current?.focus();
  }

  function applyResult(data: CheckInResult) {
    clearDismissTimer();
    setResult(data);
    pauseScanning();
    if (data.success) {
      setCheckedInCount((count) => (count === null ? count : count + 1));
      dismissTimerRef.current = setTimeout(() => {
        dismissTimerRef.current = null;
        setResult(null);
        resumeScanning();
      }, SUCCESS_AUTO_DISMISS_MS);
    }
  }

  useEffect(() => {
    return () => clearDismissTimer();
  }, []);

  // Keep the screen awake while the scanner is open (Screen Wake Lock, where supported). The
  // lock is released by the browser when the tab is hidden, so it is re-requested on return.
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) {
          await lock.release();
          return;
        }
        sentinel = lock;
      } catch {
        // Denied (e.g. low battery) or unsupported at runtime: the scanner works without it.
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') void acquire();
    }

    void acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      void sentinel?.release().catch(() => undefined);
    };
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
        undefined // per-frame "no QR found" noise — expected during normal scanning, not an error
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
    <PageShell>
      <div className="mx-auto w-full max-w-[480px] lg:mx-0">
        <PageHeader
          title="Door scanner"
          subtitle={checkedInCount === null ? undefined : `Checked in: ${checkedInCount}`}
        />

        <div className="aspect-square w-full overflow-hidden rounded-[2px] border border-rule bg-ivory">
          <div id={SCANNER_ELEMENT_ID} className="h-full w-full" />
        </div>

        {cameraStatus === 'starting' && (
          <p className="mt-3 font-sans text-[15px] text-muted">Starting camera…</p>
        )}

        {cameraFailed && (
          <div className="mt-3 space-y-3">
            <p className="font-sans text-[15px] text-ink">{CAMERA_STATUS_MESSAGE[cameraStatus]}</p>
            <button type="button" onClick={retryCamera} className={`${BUTTON_SECONDARY} w-full`}>
              Try camera again
            </button>
          </div>
        )}

        {cameraStatus === 'running' && torchFeature && (
          <button
            type="button"
            onClick={() => void toggleTorch()}
            aria-pressed={torchOn}
            className={`${BUTTON_SECONDARY} mt-3 w-full`}
          >
            {torchOn ? 'Turn off torch' : 'Turn on torch'}
          </button>
        )}

        <div className="mt-4 min-h-[72px]">{result && <DoorResultBanner result={result} />}</div>

        <form method="post" onSubmit={handleManualSubmit} className="mt-4 space-y-2">
          <label
            htmlFor="manual-ref"
            className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted"
          >
            Manual entry
          </label>
          <div className="flex gap-3">
            <input
              id="manual-ref"
              ref={manualInputRef}
              type="text"
              value={manualRef}
              onChange={(e) => setManualRef(e.target.value)}
              placeholder="Booking reference"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className={`h-12 min-w-0 flex-1 rounded-[2px] border border-rule bg-ivory px-4 font-mono text-[16px] text-ink placeholder:font-sans placeholder:text-muted ${FOCUS_RING}`}
            />
            <button type="submit" disabled={!hydrated} className={`${BUTTON_PRIMARY} h-12`}>
              Check in
            </button>
          </div>
        </form>

        <button
          type="button"
          onClick={scanNext}
          className={`${BUTTON_PRIMARY} mt-4 h-14 w-full text-[16px]`}
        >
          Scan next
        </button>
      </div>
    </PageShell>
  );
}
