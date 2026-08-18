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
