import type {
  VendorRegisterFieldChangeHandler,
  VendorRegisterFormState,
} from '@/lib/vendor-register-form-payload';
import { VendorFormField } from './VendorFormField';
import { VendorRadioGroupField } from './VendorRadioGroupField';

// Lee-Ann's 26 Aug source form, "MARKETING" section. M2 F18 (vendor-gated-registration-flow)
// -- bio gets a live word-count indicator (150-200 words, mirrors the server-side
// validateBioWordCount() bounds in lib/vendor-submissions.ts); marketingPermission is a new
// 2-option radio. Logo/product-photo upload widgets are rendered separately from
// VendorRegisterSuccess.tsx, not here -- see that file's own comment for why (no submission id
// exists yet at this point in the flow).
interface VendorMarketingFieldsetProps {
  state: VendorRegisterFormState;
  onFieldChange: VendorRegisterFieldChangeHandler;
  disabled: boolean;
}

// Mirrors BIO_MIN_WORDS/BIO_MAX_WORDS in lib/vendor-submissions.ts -- kept as separate
// UI-local constants (not imported) since that module is server-only (Firestore imports).
const BIO_MIN_WORDS = 150;
const BIO_MAX_WORDS = 200;

const MARKETING_PERMISSION_OPTIONS = [
  {
    value: 'full',
    label:
      'I give permission for SAOC to use my business name, logo, and photos for marketing purposes.',
  },
  {
    value: 'listing-only',
    label: 'I only want my business listed as a vendor, with no additional marketing use.',
  },
];

function countWords(value: string): number {
  const trimmed = value.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

export function VendorMarketingFieldset({ state, onFieldChange, disabled }: VendorMarketingFieldsetProps) {
  const bioWordCount = countWords(state.bio);
  const bioInBounds = bioWordCount >= BIO_MIN_WORDS && bioWordCount <= BIO_MAX_WORDS;

  return (
    <div className="space-y-5">
      <h2 className="font-serif text-[20px] font-semibold text-ink">Marketing</h2>

      <VendorFormField
        fieldKey="bio"
        label={`Short vendor bio/description for the website and show programme (${BIO_MIN_WORDS}–${BIO_MAX_WORDS} words)`}
        htmlType="textarea"
        value={state.bio}
        onChange={(v) => onFieldChange('bio', v)}
        disabled={disabled}
        required={false}
        maxLength={2000}
      />
      <p
        aria-live="polite"
        className={`font-sans text-[13px] ${bioWordCount === 0 || bioInBounds ? 'text-muted' : 'text-red-700'}`}
      >
        {bioWordCount} word{bioWordCount === 1 ? '' : 's'} (needs {BIO_MIN_WORDS}–{BIO_MAX_WORDS})
      </p>

      <VendorRadioGroupField
        fieldKey="marketingPermission"
        label="Marketing permission"
        options={MARKETING_PERMISSION_OPTIONS}
        value={state.marketingPermission}
        onChange={(v) => onFieldChange('marketingPermission', v)}
        disabled={disabled}
        required={false}
      />
    </div>
  );
}
