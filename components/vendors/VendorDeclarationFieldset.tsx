import type {
  VendorRegisterFieldChangeHandler,
  VendorRegisterFormState,
} from '@/lib/vendor-register-form-payload';
import { VendorFormField } from './VendorFormField';
import { VendorTermsFieldset } from './VendorTermsFieldset';

// M2 F20 (vendor-gated-registration-flow) -- replaces the never-actually-existing 12-point
// declaration list with the 26 Aug source doc's 6-point "VENDOR DECLARATION" (verbatim), the
// full 14-clause "TERMS AND CONDITIONS" prose (VendorTermsFieldset.tsx, verbatim), and the
// signature block. See the M2 golden README's "What was never actually there" -- no prior
// declaration/T&Cs content existed anywhere in components/vendors/ before this file.
interface VendorDeclarationFieldsetProps {
  state: VendorRegisterFormState;
  onFieldChange: VendorRegisterFieldChangeHandler;
  disabled: boolean;
}

// The 6 declaration points, verbatim from the source doc's "VENDOR DECLARATION" section.
const DECLARATION_POINTS = [
  'I/We confirm that the information supplied in this Vendor Registration Form is true, accurate and complete to the best of my/our knowledge.',
  'I/We confirm that I/We have disclosed all products, services, activities and equipment intended to be offered, displayed, demonstrated or undertaken at the 2027 SAOC National Show.',
  'I/We confirm that I/We have read, understood and agree to comply with the 2027 SAOC National Show Vendor Terms & Conditions set out below.',
  'I/We agree to comply with all applicable South African laws, regulations, permits, health and safety requirements, plant health requirements, municipal requirements and venue rules applicable to my/our participation in the Show.',
  'I/We undertake to obtain and maintain, at my/our own cost, all permits, licences, certificates, approvals and other authorisations required for my/our business, products, activities and participation in the Show.',
  'I/We will not sell, display, demonstrate or promote products or undertake activities that have not been declared in this registration form where such declaration is required, or where prior approval has been requested by the Show Organising Committee.',
];

export function VendorDeclarationFieldset({
  state,
  onFieldChange,
  disabled,
}: VendorDeclarationFieldsetProps) {
  return (
    <div className="space-y-5">
      <h2 className="font-serif text-[20px] font-semibold text-ink">Declaration &amp; Terms</h2>

      <ol className="list-decimal space-y-2 pl-5 font-sans text-[14.5px] leading-relaxed text-ink/90">
        {DECLARATION_POINTS.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ol>

      <VendorTermsFieldset />

      {/* Vendor / Authorised Representative signature block, per the source doc's own
          "Full Name / Position / Business Name / Signature / Date" fields. Position and
          Business Name are READ-ONLY reflections of contactPosition/businessName, never a
          second editable input -- see the M2 golden README's "The signature block". */}
      <div className="space-y-3 border-t border-rule pt-5">
        <h3 className="font-serif text-[16px] font-semibold text-ink">
          Vendor / Authorised Representative
        </h3>
        <VendorFormField
          fieldKey="signatureFullName"
          label="Full name (signature)"
          htmlType="text"
          value={state.signatureFullName}
          onChange={(v) => onFieldChange('signatureFullName', v)}
          disabled={disabled}
          required={false}
          maxLength={150}
        />
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <dt className="font-mono text-[10.5px] tracking-[0.12em] text-muted">Position</dt>
            <dd className="font-sans text-[14px] text-ink">{state.contactPosition || '—'}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10.5px] tracking-[0.12em] text-muted">Business name</dt>
            <dd className="font-sans text-[14px] text-ink">{state.businessName || '—'}</dd>
          </div>
          <div>
            {/* @qa finding, 2026-09-01 (M2 fix pass): this fieldset only ever renders on the
                live, unsubmitted form -- there is no real submittedAt (types/index.ts:124)
                to show yet, since that value is assigned server-side once the submission is
                accepted. Labelling the browser clock "(date of submission)" here was
                dishonest -- it is today's date, not the eventual submission date. Once
                accepted, this fieldset is replaced by VendorRegisterSuccess, which is the
                system-owned point a real submittedAt would be shown, if this signature block
                is ever rendered there too. */}
            <dt className="font-mono text-[10.5px] tracking-[0.12em] text-muted">
              Today&apos;s date
            </dt>
            <dd className="font-sans text-[14px] text-ink">
              {new Date().toLocaleDateString('en-ZA')}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
