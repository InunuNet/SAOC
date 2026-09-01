import type {
  VendorRegisterFieldChangeHandler,
  VendorRegisterFormState,
} from '@/lib/vendor-register-form-payload';
import { VendorFormField } from './VendorFormField';

// Primary/accounts contact-person fields, extracted out of VendorContactFieldset.tsx to keep
// that component under this project's 150-line-per-component convention (see
// .claude/rules/coding.md). Rendered within the "Contact & business details" section -- no own
// <h2>.
interface VendorPrimaryContactFieldsetProps {
  state: VendorRegisterFormState;
  onFieldChange: VendorRegisterFieldChangeHandler;
  disabled: boolean;
}

export function VendorPrimaryContactFieldset({
  state,
  onFieldChange,
  disabled,
}: VendorPrimaryContactFieldsetProps) {
  return (
    <>
      <VendorFormField
        fieldKey="contactPersonName"
        label="Contact person full name"
        htmlType="text"
        value={state.contactPersonName}
        onChange={(v) => onFieldChange('contactPersonName', v)}
        disabled={disabled}
        required
        maxLength={150}
      />
      <VendorFormField
        fieldKey="contactPosition"
        label="Contact person position"
        htmlType="text"
        value={state.contactPosition}
        onChange={(v) => onFieldChange('contactPosition', v)}
        disabled={disabled}
        required={false}
        maxLength={150}
      />
      <VendorFormField
        fieldKey="contactEmail"
        label="Monitored email address"
        htmlType="email"
        value={state.contactEmail}
        onChange={(v) => onFieldChange('contactEmail', v)}
        disabled={disabled}
        required
        maxLength={254}
      />
      <VendorFormField
        fieldKey="contactCellPhone"
        label="Cell phone contact number"
        htmlType="tel"
        value={state.contactCellPhone}
        onChange={(v) => onFieldChange('contactCellPhone', v)}
        disabled={disabled}
        required
        maxLength={30}
        pattern="^(?=.*[0-9])[0-9+\-() ]{7,20}$"
      />
      <VendorFormField
        fieldKey="alternativeContactNumber"
        label="Alternative contact number"
        htmlType="tel"
        value={state.alternativeContactNumber}
        onChange={(v) => onFieldChange('alternativeContactNumber', v)}
        disabled={disabled}
        required={false}
        maxLength={30}
        pattern="^(?=.*[0-9])[0-9+\-() ]{7,20}$"
      />

      <VendorFormField
        fieldKey="accountsContactName"
        label="Accounts contact name"
        htmlType="text"
        value={state.accountsContactName}
        onChange={(v) => onFieldChange('accountsContactName', v)}
        disabled={disabled}
        required={false}
        maxLength={150}
      />
      <VendorFormField
        fieldKey="accountsContactEmail"
        label="Accounts contact email"
        htmlType="email"
        value={state.accountsContactEmail}
        onChange={(v) => onFieldChange('accountsContactEmail', v)}
        disabled={disabled}
        required={false}
        maxLength={254}
      />
    </>
  );
}
