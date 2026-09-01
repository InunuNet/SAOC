import {
  isPostalAddressFieldApplicable,
  isVatNumberFieldApplicable,
  type VendorRegisterFieldChangeHandler,
  type VendorRegisterFormState,
} from '@/lib/vendor-register-form-payload';
import { VendorBooleanRadioField } from './VendorBooleanRadioField';
import { VendorCheckboxField } from './VendorCheckboxField';
import { VendorFormField } from './VendorFormField';

// VAT/registration-country/address fields, extracted out of VendorBusinessIdentityFieldset.tsx
// to keep both components under this project's 150-line-per-component convention (see
// .claude/rules/coding.md). Rendered immediately after VendorBusinessIdentityFieldset within
// the "Contact & business details" section -- no own <h2>.
interface VendorBusinessAddressFieldsetProps {
  state: VendorRegisterFormState;
  onFieldChange: VendorRegisterFieldChangeHandler;
  disabled: boolean;
}

const VAT_REGISTERED_OPTIONS = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

export function VendorBusinessAddressFieldset({
  state,
  onFieldChange,
  disabled,
}: VendorBusinessAddressFieldsetProps) {
  return (
    <>
      <VendorBooleanRadioField
        fieldKey="vatRegistered"
        label="VAT registered"
        options={VAT_REGISTERED_OPTIONS}
        value={state.vatRegistered}
        onChange={(v) => onFieldChange('vatRegistered', v)}
        disabled={disabled}
        required={false}
      />
      {isVatNumberFieldApplicable(state) ? (
        <VendorFormField
          fieldKey="vatNumber"
          label="VAT number"
          htmlType="text"
          value={state.vatNumber}
          onChange={(v) => onFieldChange('vatNumber', v)}
          disabled={disabled}
          required={false}
          placeholder="e.g. 4123456789"
          maxLength={50}
        />
      ) : null}
      <VendorFormField
        fieldKey="countryOfBusinessRegistration"
        label="Country of business registration"
        htmlType="text"
        value={state.countryOfBusinessRegistration}
        onChange={(v) => onFieldChange('countryOfBusinessRegistration', v)}
        disabled={disabled}
        required={false}
        maxLength={100}
      />
      <VendorFormField
        fieldKey="physicalAddress"
        label="Physical business address"
        htmlType="textarea"
        value={state.physicalAddress}
        onChange={(v) => onFieldChange('physicalAddress', v)}
        disabled={disabled}
        required
        maxLength={500}
      />

      <VendorCheckboxField
        fieldKey="postalAddressSameAsPhysical"
        label="Postal address same as physical address"
        value={state.postalAddressSameAsPhysical}
        onChange={(v) => onFieldChange('postalAddressSameAsPhysical', v)}
        disabled={disabled}
        required={false}
      />
      {isPostalAddressFieldApplicable(state) ? (
        <VendorFormField
          fieldKey="postalAddress"
          label="Postal address"
          htmlType="textarea"
          value={state.postalAddress}
          onChange={(v) => onFieldChange('postalAddress', v)}
          disabled={disabled}
          required={false}
          maxLength={500}
        />
      ) : null}
    </>
  );
}
