import {
  isTradingNameFieldApplicable,
  type VendorRegisterFieldChangeHandler,
  type VendorRegisterFormState,
} from '@/lib/vendor-register-form-payload';
import { VendorBusinessAddressFieldset } from './VendorBusinessAddressFieldset';
import { VendorCheckboxField } from './VendorCheckboxField';
import { VendorFormField } from './VendorFormField';
import { VendorRadioGroupField } from './VendorRadioGroupField';

// Business identity/registration/address fields, extracted out of VendorContactFieldset.tsx to
// keep that component under this project's 150-line-per-component convention (see
// .claude/rules/coding.md). Rendered as the first block of the "Contact & business details"
// section -- no own <h2>, so it reads as one continuous section to the vendor.
interface VendorBusinessIdentityFieldsetProps {
  state: VendorRegisterFormState;
  onFieldChange: VendorRegisterFieldChangeHandler;
  disabled: boolean;
}

const BUSINESS_ENTITY_TYPE_OPTIONS = [
  { value: 'company', label: 'Company' },
  { value: 'close-corporation', label: 'Close Corporation' },
  { value: 'sole-proprietor', label: 'Sole Proprietor' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'individual', label: 'Individual' },
  { value: 'other', label: 'Other' },
];

export function VendorBusinessIdentityFieldset({
  state,
  onFieldChange,
  disabled,
}: VendorBusinessIdentityFieldsetProps) {
  return (
    <>
      <VendorFormField
        fieldKey="businessName"
        label="Vendor / business name"
        htmlType="text"
        value={state.businessName}
        onChange={(v) => onFieldChange('businessName', v)}
        disabled={disabled}
        required
        maxLength={200}
      />
      <VendorCheckboxField
        fieldKey="tradingNameSameAsBusiness"
        label="Trading name same as business name"
        value={state.tradingNameSameAsBusiness}
        onChange={(v) => onFieldChange('tradingNameSameAsBusiness', v)}
        disabled={disabled}
        required={false}
      />
      {isTradingNameFieldApplicable(state) ? (
        <VendorFormField
          fieldKey="tradingName"
          label="Trading name (if different)"
          htmlType="text"
          value={state.tradingName}
          onChange={(v) => onFieldChange('tradingName', v)}
          disabled={disabled}
          required={false}
          maxLength={200}
        />
      ) : null}
      <VendorRadioGroupField
        fieldKey="businessEntityType"
        label="Business entity type"
        options={BUSINESS_ENTITY_TYPE_OPTIONS}
        value={state.businessEntityType}
        onChange={(v) => onFieldChange('businessEntityType', v)}
        disabled={disabled}
        required={false}
      />
      {state.businessEntityType === 'other' ? (
        <VendorFormField
          fieldKey="businessEntityTypeOther"
          label="Business entity type (other)"
          htmlType="text"
          value={state.businessEntityTypeOther}
          onChange={(v) => onFieldChange('businessEntityTypeOther', v)}
          disabled={disabled}
          required={false}
          maxLength={100}
        />
      ) : null}
      <VendorFormField
        fieldKey="cipcNumber"
        label="Business registration (CIPC) number"
        htmlType="text"
        value={state.cipcNumber}
        onChange={(v) => onFieldChange('cipcNumber', v)}
        disabled={disabled}
        required={false}
        placeholder="e.g. 2019/123456/07"
        maxLength={50}
      />
      <VendorBusinessAddressFieldset state={state} onFieldChange={onFieldChange} disabled={disabled} />
    </>
  );
}
