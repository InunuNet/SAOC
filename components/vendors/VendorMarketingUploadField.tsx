'use client';

import { useState } from 'react';

// M2 F18 (vendor-gated-registration-flow) -- single logo/product-photo upload widget. POSTs
// directly to /api/vendors/[id]/marketing-asset once a submission id exists -- mirrors F7's
// proof-of-payment out-of-band posture (see lib/vendor-register-form-payload.ts's own comment
// on marketingPermission). Rendered from VendorRegisterSuccess.tsx, where descriptor.id (the
// real submission id) is already available -- there is no earlier point in the flow where a
// submission id exists to upload against.
interface VendorMarketingUploadFieldProps {
  submissionId: string;
  assetSlot: 'logo' | 'product-photo-1' | 'product-photo-2' | 'product-photo-3';
  label: string;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // data URLs are "data:<mime>;base64,<payload>" -- strip the prefix.
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function VendorMarketingUploadField({
  submissionId,
  assetSlot,
  label,
}: VendorMarketingUploadFieldProps) {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const id = `vendor-marketing-upload-${assetSlot}`;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setStatus('error');
      setErrorMessage('Please choose a JPEG, PNG, or WEBP image.');
      return;
    }

    setStatus('uploading');
    setErrorMessage(null);

    try {
      const fileBase64 = await readFileAsBase64(file);
      const res = await fetch(`/api/vendors/${submissionId}/marketing-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetSlot,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          fileBase64,
        }),
      });
      if (res.ok) {
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMessage('Upload failed. Please try again.');
      }
    } catch {
      setStatus('error');
      setErrorMessage('Upload failed. Please check your connection and try again.');
    }
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="font-mono text-[11px] tracking-[0.16em] text-muted">
        {label}
      </label>
      <input
        id={id}
        type="file"
        accept={ALLOWED_MIME_TYPES.join(',')}
        onChange={handleFileChange}
        disabled={status === 'uploading'}
        className="block w-full font-sans text-[14px] text-ink file:mr-3 file:rounded-sm file:border file:border-rule file:bg-ivory file:px-3 file:py-1.5 file:font-sans file:text-[13px] file:text-ink"
      />
      {status === 'uploading' ? <p className="font-sans text-[13px] text-muted">Uploading…</p> : null}
      {status === 'success' ? <p className="font-sans text-[13px] text-ink">Uploaded.</p> : null}
      {status === 'error' && errorMessage ? (
        <p role="alert" className="font-sans text-[13px] text-red-700">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
