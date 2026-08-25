import {
  isPostalAddressFieldApplicable,
  isTradingNameFieldApplicable,
  isVatNumberFieldApplicable,
  type VendorRegisterFieldChangeHandler,
  type VendorRegisterFormState,
} from '@/lib/vendor-register-form-payload';
import { VendorBooleanRadioField } from './VendorBooleanRadioField';
import { VendorCheckboxField } from './VendorCheckboxField';
import { VendorFormField } from './VendorFormField';
import { VendorRadioGroupField } from './VendorRadioGroupField';

// Lee-Ann's source form, section 1 ("Contact & business details"), fields 1-17 -- reordered to
// follow the source document's own structure; see the F2 golden's "Files touched" #5 for the
// reorder judgement call.
interface VendorContactFieldsetProps {
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

const VAT_REGISTERED_OPTIONS = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

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

      <VendorFormField
        fieldKey="website"
        label="Website"
        htmlType="url"
        value={state.website}
        onChange={(v) => onFieldChange('website', v)}
        disabled={disabled}
        required={false}
        maxLength={300}
      />
      <VendorFormField
        fieldKey="socialMediaHandle"
        label="Social media handle(s)"
        htmlType="text"
        value={state.socialMediaHandle}
        onChange={(v) => onFieldChange('socialMediaHandle', v)}
        disabled={disabled}
        required={false}
        maxLength={200}
      />
    </div>
  );
}
