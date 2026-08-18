import type {
  VendorRegisterFieldChangeHandler,
  VendorRegisterFormState,
} from '@/lib/vendor-register-form-payload';
import { VendorFormField } from './VendorFormField';

// Lee-Ann's source form, section 1 ("Contact & business details"), fields 1-10 -- labels
// verbatim from contracts/golden/vendor-form-ui/field-spec.golden.json (section: "contact").
interface VendorContactFieldsetProps {
  state: VendorRegisterFormState;
  onFieldChange: VendorRegisterFieldChangeHandler;
  disabled: boolean;
}

export function VendorContactFieldset({ state, onFieldChange, disabled }: VendorContactFieldsetProps) {
  return (
    <div className="space-y-5">
      <h2 className="font-serif text-[20px] font-semibold text-ink">Contact &amp; business details</h2>

      <VendorFormField
        fieldKey="businessName"
        label="Vendor / business name"
        htmlType="text"
        value={state.businessName}
        onChange={(v) => onFieldChange('businessName', v)}
        disabled={disabled}
        required
      />
      <VendorFormField
        fieldKey="tradingName"
        label="Trading name (if different)"
        htmlType="text"
        value={state.tradingName}
        onChange={(v) => onFieldChange('tradingName', v)}
        disabled={disabled}
        required={false}
      />
      <VendorFormField
        fieldKey="contactPersonName"
        label="Contact person full name"
        htmlType="text"
        value={state.contactPersonName}
        onChange={(v) => onFieldChange('contactPersonName', v)}
        disabled={disabled}
        required
      />
      <VendorFormField
        fieldKey="contactCellPhone"
        label="Cell phone contact number"
        htmlType="tel"
        value={state.contactCellPhone}
        onChange={(v) => onFieldChange('contactCellPhone', v)}
        disabled={disabled}
        required
      />
      <VendorFormField
        fieldKey="contactEmail"
        label="Monitored email address"
        htmlType="email"
        value={state.contactEmail}
        onChange={(v) => onFieldChange('contactEmail', v)}
        disabled={disabled}
        required
      />
      <VendorFormField
        fieldKey="physicalAddress"
        label="Physical business address"
        htmlType="textarea"
        value={state.physicalAddress}
        onChange={(v) => onFieldChange('physicalAddress', v)}
        disabled={disabled}
        required={false}
      />
      <VendorFormField
        fieldKey="cipcNumber"
        label="Business registration (CIPC) number"
        htmlType="text"
        value={state.cipcNumber}
        onChange={(v) => onFieldChange('cipcNumber', v)}
        disabled={disabled}
        required={false}
        placeholder="e.g. 2019/123456/07"
      />
      <VendorFormField
        fieldKey="vatNumber"
        label="VAT number (if applicable)"
        htmlType="text"
        value={state.vatNumber}
        onChange={(v) => onFieldChange('vatNumber', v)}
        disabled={disabled}
        required={false}
        placeholder="e.g. 4123456789"
      />
      <VendorFormField
        fieldKey="website"
        label="Website"
        htmlType="url"
        value={state.website}
        onChange={(v) => onFieldChange('website', v)}
        disabled={disabled}
        required={false}
      />
      <VendorFormField
        fieldKey="socialMediaHandle"
        label="Social media handle(s)"
        htmlType="text"
        value={state.socialMediaHandle}
        onChange={(v) => onFieldChange('socialMediaHandle', v)}
        disabled={disabled}
        required={false}
      />
    </div>
  );
}
