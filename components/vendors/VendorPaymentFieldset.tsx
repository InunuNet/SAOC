import type {
  VendorRegisterFieldChangeHandler,
  VendorRegisterFormState,
} from '@/lib/vendor-register-form-payload';
import { VendorFormField } from './VendorFormField';
import { VendorCheckboxGroupField } from './VendorCheckboxGroupField';
import { VendorCheckboxField } from './VendorCheckboxField';

// Lee-Ann's source form, section 5 ("Payment & terms"), fields 29-31 -- labels verbatim from
// contracts/golden/vendor-form-ui/field-spec.golden.json (section: "payment").
interface VendorPaymentFieldsetProps {
  state: VendorRegisterFormState;
  onFieldChange: VendorRegisterFieldChangeHandler;
  disabled: boolean;
}

const PAYMENT_METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'eft', label: 'EFT / Instant payment' },
  { value: 'not-applicable', label: 'Not applicable' },
];

export function VendorPaymentFieldset({ state, onFieldChange, disabled }: VendorPaymentFieldsetProps) {
  return (
    <div className="space-y-5">
      <h2 className="font-serif text-[20px] font-semibold text-ink">Payment &amp; terms</h2>

      {/* F1 (vendor-form-copy-20261007) -- Lee-Ann's 2026-10-07 source doc places this note
          between the Gas section and VENDOR DECLARATION; thematically it is about payment
          confirming the booth, and this fieldset is the section mounted immediately before
          VendorDeclarationFieldset. */}
      <p className="font-sans text-[13px] leading-relaxed text-ink/70">
        Booths spaces are confirmed only once this registration form has been received and the payment has reflected in the bank account.
      </p>

      {/* M2 F14/F19 (vendor-gated-registration-flow) -- two new insurance policy-number
          fields, alongside the unmodified M1 hasPublicLiabilityInsurance/
          productLiabilityInsuranceStatus fields (not yet rendered by any fieldset -- pre-
          existing gap, out of M2's scope to fix; see lib/vendor-register-form-payload.ts). */}
      <VendorFormField
        fieldKey="publicLiabilityInsurancePolicyNumber"
        label="Public liability insurance policy number"
        htmlType="text"
        value={state.publicLiabilityInsurancePolicyNumber}
        onChange={(v) => onFieldChange('publicLiabilityInsurancePolicyNumber', v)}
        disabled={disabled}
        required={false}
        maxLength={100}
      />
      <VendorFormField
        fieldKey="productLiabilityInsurancePolicyNumber"
        label="Product liability insurance policy number"
        htmlType="text"
        value={state.productLiabilityInsurancePolicyNumber}
        onChange={(v) => onFieldChange('productLiabilityInsurancePolicyNumber', v)}
        disabled={disabled}
        required={false}
        maxLength={100}
      />

      <VendorCheckboxGroupField
        fieldKey="paymentMethodsAccepted"
        label="On-site payment methods you will accept from customers"
        options={PAYMENT_METHOD_OPTIONS}
        value={state.paymentMethodsAccepted}
        onChange={(v) => onFieldChange('paymentMethodsAccepted', v)}
        disabled={disabled}
        required={false}
      />
      <VendorFormField
        fieldKey="paymentReference"
        label="Booth fee payment reference / proof of payment"
        htmlType="text"
        value={state.paymentReference}
        onChange={(v) => onFieldChange('paymentReference', v)}
        disabled={disabled}
        required={false}
        maxLength={200}
      />
      <VendorCheckboxField
        fieldKey="termsAccepted"
        label="I confirm I have read and agree to the Vendor Terms & Conditions of the 2027 SAOC National Show."
        value={state.termsAccepted}
        onChange={(v) => onFieldChange('termsAccepted', v)}
        disabled={disabled}
        required
      />
    </div>
  );
}
