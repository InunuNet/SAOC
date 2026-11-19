'use client';

import { useEffect, useState } from 'react';

import { OptionGroup } from '@/components/admin/studio/OptionGroup';
import { usePreviews } from '@/components/admin/studio/usePreviews';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD_CLASS } from '@/components/admin/tokens';
import { FormErrorAlert } from '@/components/ui/FormErrorAlert';
import { designContrast } from '@/lib/ticket-design/contrast';
import { DESIGN_ENUMS, type EmailDesign, type PdfDesign, type ShippedDesign } from '@/lib/ticket-design/schema';
import type { StudioTypeOption } from '@/lib/ticket-design/studio-samples';

const SAVE_ENDPOINT = '/api/admin/studio/save';
const EXPORT_ENDPOINT = '/api/admin/studio/export';
const CONTRAST_DECIMALS = 1;

interface StudioClientProps {
  types: StudioTypeOption[];
  initialSlug: string;
  initialDesign: ShippedDesign;
}

type SharedKey = keyof typeof DESIGN_ENUMS.shared;
type SaveState = { kind: 'idle' } | { kind: 'saved'; path: string } | { kind: 'error'; message: string };

type ExportState =
  | { kind: 'idle' }
  | { kind: 'done'; paths: string[] }
  | { kind: 'error'; message: string };

export function StudioClient({ types, initialSlug, initialDesign }: StudioClientProps) {
  const [slug, setSlug] = useState(initialSlug);
  const [saved, setSaved] = useState(initialDesign);
  const [design, setDesign] = useState(initialDesign);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });
  const [exporting, setExporting] = useState(false);
  const [exportState, setExportState] = useState<ExportState>({ kind: 'idle' });
  const previews = usePreviews(design);
  const readings = designContrast(design);
  const blocked = readings.some((reading) => !reading.passes);
  const dirty = JSON.stringify(design) !== JSON.stringify(saved);

  useEffect(() => {
    if (dirty) setSaveState({ kind: 'idle' });
  }, [dirty]);

  function setShared<K extends SharedKey>(key: K, value: EmailDesign[K] & PdfDesign[K]) {
    setDesign((current) => ({
      ...current,
      email: { ...current.email, [key]: value },
      pdf: { ...current.pdf, [key]: value },
    }));
  }

  function setEmail<K extends keyof EmailDesign>(key: K, value: EmailDesign[K]) {
    setDesign((current) => ({ ...current, email: { ...current.email, [key]: value } }));
  }

  function setPdf<K extends keyof PdfDesign>(key: K, value: PdfDesign[K]) {
    setDesign((current) => ({ ...current, pdf: { ...current.pdf, [key]: value } }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(SAVE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ design }),
      });
      const body: { saved?: string; error?: string } = await res.json();
      if (!res.ok || !body.saved) throw new Error(body.error ?? 'Save failed');
      setSaved(design);
      setSaveState({ kind: 'saved', path: body.saved });
    } catch (error) {
      setSaveState({ kind: 'error', message: error instanceof Error ? error.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch(EXPORT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const body: { written?: string[]; error?: string } = await res.json();
      if (!res.ok || !body.written) throw new Error(body.error ?? 'Export failed');
      setExportState({ kind: 'done', paths: body.written });
    } catch (error) {
      setExportState({ kind: 'error', message: error instanceof Error ? error.message : 'Export failed' });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <section className={CARD_CLASS}>
          <label htmlFor="studio-type" className="block font-sans text-[13px] font-semibold text-ink">
            Ticket type
          </label>
          <select
            id="studio-type"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            className="mt-1 min-h-[44px] w-full rounded-[2px] border border-rule bg-ivory px-3 font-sans text-[14px] text-ink"
          >
            {types.map((type) => (
              <option key={type.slug} value={type.slug} disabled={!type.enabled}>
                {type.label}
                {type.enabled ? '' : ' (not yet)'}
              </option>
            ))}
          </select>
          <p className="mt-2 font-sans text-[13px] text-muted">VIP is the pilot; other types follow.</p>
        </section>

        <section className={`${CARD_CLASS} flex flex-col gap-4`}>
          <h2 className="font-serif text-[20px] font-semibold text-ink">Both</h2>
          <OptionGroup legend="Accent" name="accent" options={DESIGN_ENUMS.shared.accent} value={design.email.accent} onChange={(v) => setShared('accent', v)} />
          <OptionGroup legend="Header ground" name="headerGround" options={DESIGN_ENUMS.shared.headerGround} value={design.email.headerGround} onChange={(v) => setShared('headerGround', v)} />
          <OptionGroup legend="Type size" name="typeStep" options={DESIGN_ENUMS.shared.typeStep} value={design.email.typeStep} onChange={(v) => setShared('typeStep', v)} />
          <OptionGroup legend="Density" name="density" options={DESIGN_ENUMS.shared.density} value={design.email.density} onChange={(v) => setShared('density', v)} />
          <OptionGroup legend="Footer mark" name="footerMark" options={DESIGN_ENUMS.shared.footerMark} value={design.email.footerMark} onChange={(v) => setShared('footerMark', v)} />
        </section>

        <section className={`${CARD_CLASS} flex flex-col gap-4`}>
          <h2 className="font-serif text-[20px] font-semibold text-ink">Email only</h2>
          <OptionGroup legend="Outer ground" name="outerGround" options={DESIGN_ENUMS.email.outerGround} value={design.email.outerGround} onChange={(v) => setEmail('outerGround', v)} />
          <OptionGroup legend="Card ground" name="cardGround" options={DESIGN_ENUMS.email.cardGround} value={design.email.cardGround} onChange={(v) => setEmail('cardGround', v)} />
          <OptionGroup legend="Header alignment" name="headerAlign" options={DESIGN_ENUMS.email.headerAlign} value={design.email.headerAlign} onChange={(v) => setEmail('headerAlign', v)} />
          <OptionGroup legend="QR size (px)" name="qrPx" options={DESIGN_ENUMS.email.qrPx} value={design.email.qrPx} onChange={(v) => setEmail('qrPx', v)} />
          <OptionGroup legend="Ticket card position" name="cardPosition" options={DESIGN_ENUMS.email.cardPosition} value={design.email.cardPosition} onChange={(v) => setEmail('cardPosition', v)} />
        </section>

        <section className={`${CARD_CLASS} flex flex-col gap-4`}>
          <h2 className="font-serif text-[20px] font-semibold text-ink">Ticket PDF only</h2>
          <OptionGroup legend="Stub ground" name="stubGround" options={DESIGN_ENUMS.pdf.stubGround} value={design.pdf.stubGround} onChange={(v) => setPdf('stubGround', v)} />
          <OptionGroup legend="Rule colour" name="ruleColour" options={DESIGN_ENUMS.pdf.ruleColour} value={design.pdf.ruleColour} onChange={(v) => setPdf('ruleColour', v)} />
          <OptionGroup legend="QR size (mm)" name="qrMm" options={DESIGN_ENUMS.pdf.qrMm} value={design.pdf.qrMm} onChange={(v) => setPdf('qrMm', v)} />
        </section>

        <section className={CARD_CLASS} aria-label="Contrast">
          <h2 className="font-serif text-[20px] font-semibold text-ink">Contrast (WCAG, min 4.5:1)</h2>
          <ul className="mt-2 font-sans text-[14px] text-ink">
            {readings.map((reading) => (
              <li key={reading.label}>
                {reading.label}: {reading.ratio.toFixed(CONTRAST_DECIMALS)}:1 {reading.passes ? 'passes' : 'fails'}
              </li>
            ))}
          </ul>
          {blocked ? (
            <div className="mt-3">
              <FormErrorAlert>This combination is under 4.5:1 and cannot be saved.</FormErrorAlert>
            </div>
          ) : null}
        </section>

        <div className="flex flex-wrap gap-3">
          <button type="button" className={BUTTON_PRIMARY} disabled={saving || blocked || !dirty} onClick={() => void handleSave()}>
            {saving ? 'Saving…' : 'Save to settings file'}
          </button>
          <button type="button" className={BUTTON_SECONDARY} disabled={!dirty} onClick={() => setDesign(saved)}>
            Reset
          </button>
          <button type="button" className={BUTTON_SECONDARY} disabled={exporting || dirty} onClick={() => void handleExport()}>
            {exporting ? 'Exporting…' : 'Export samples'}
          </button>
        </div>
        <div role="status" className="font-sans text-[14px] text-ink">
          {exportState.kind === 'done' ? (
            <>
              Wrote:
              <ul>
                {exportState.paths.map((written) => (
                  <li key={written}>{written}</li>
                ))}
              </ul>
            </>
          ) : null}
          {exportState.kind === 'error' ? <FormErrorAlert>{exportState.message}</FormErrorAlert> : null}
        </div>
        <div role="status" className="font-sans text-[14px] text-ink">
          {saveState.kind === 'saved' ? `Saved to ${saveState.path}. Review the diff and commit it.` : null}
          {saveState.kind === 'error' ? <FormErrorAlert>{saveState.message}</FormErrorAlert> : null}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        <section className={CARD_CLASS}>
          <h2 className="font-serif text-[20px] font-semibold text-ink">Confirmation email</h2>
          {previews.emailError ? <FormErrorAlert>{previews.emailError}</FormErrorAlert> : null}
          <iframe
            title="Confirmation email preview"
            sandbox=""
            srcDoc={previews.emailHtml ?? ''}
            className="mt-3 h-[720px] w-full rounded-[2px] border border-rule bg-white"
          />
        </section>
        <section className={CARD_CLASS}>
          <h2 className="font-serif text-[20px] font-semibold text-ink">Ticket PDF</h2>
          {previews.pdfError ? <FormErrorAlert>{previews.pdfError}</FormErrorAlert> : null}
          {previews.pdfUrl ? (
            <object
              data={previews.pdfUrl}
              type="application/pdf"
              aria-label="Ticket PDF preview"
              className="mt-3 h-[720px] w-full rounded-[2px] border border-rule"
            >
              <a href={previews.pdfUrl}>Open the ticket PDF</a>
            </object>
          ) : null}
        </section>
      </div>
    </div>
  );
}
