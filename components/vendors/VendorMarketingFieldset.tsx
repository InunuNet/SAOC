import type {
  VendorRegisterFieldChangeHandler,
  VendorRegisterFormState,
} from '@/lib/vendor-register-form-payload';
import { VendorFormField } from './VendorFormField';

// Lee-Ann's source form, section 4 ("Marketing"), field 28 -- label verbatim from
// contracts/golden/vendor-form-ui/field-spec.golden.json (section: "marketing").
interface VendorMarketingFieldsetProps {
  state: VendorRegisterFormState;
  onFieldChange: VendorRegisterFieldChangeHandler;
  disabled: boolean;
}

export function VendorMarketingFieldset({ state, onFieldChange, disabled }: VendorMarketingFieldsetProps) {
  return (
    <div className="space-y-5">
      <h2 className="font-serif text-[20px] font-semibold text-ink">Marketing</h2>

      <VendorFormField
        fieldKey="bio"
        label="Short vendor bio/description for the website and show programme (50–100 words)"
        htmlType="textarea"
        value={state.bio}
        onChange={(v) => onFieldChange('bio', v)}
        disabled={disabled}
        required={false}
        maxLength={1000}
      />
    </div>
  );
}
