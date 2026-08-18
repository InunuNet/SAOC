import {
  isFoodRetailer,
  type VendorRegisterFieldChangeHandler,
  type VendorRegisterFormState,
} from '@/lib/vendor-register-form-payload';
import { VendorFormField } from './VendorFormField';
import { VendorCheckboxGroupField } from './VendorCheckboxGroupField';

// Lee-Ann's source form, section 2 ("Products & category"), fields 11-16 -- labels verbatim
// from contracts/golden/vendor-form-ui/field-spec.golden.json (section: "category").
interface VendorCategoryFieldsetProps {
  state: VendorRegisterFormState;
  onFieldChange: VendorRegisterFieldChangeHandler;
  disabled: boolean;
}

const VENDOR_CATEGORY_OPTIONS = [
  { value: 'plant-sales', label: 'Orchid plant sales' },
  { value: 'product-sales', label: 'Orchid product sales' },
  { value: 'rare-exotic-plants', label: 'Rare or exotic plants' },
  { value: 'food-retailer', label: 'Food retailer' },
  { value: 'hardware', label: 'Hardware sales — e.g. greenhouse infrastructure' },
  { value: 'books', label: 'Books' },
  { value: 'art', label: 'Art' },
  { value: 'other', label: 'Other (please specify below)' },
];

export function VendorCategoryFieldset({ state, onFieldChange, disabled }: VendorCategoryFieldsetProps) {
  return (
    <div className="space-y-5">
      <h2 className="font-serif text-[20px] font-semibold text-ink">Products &amp; category</h2>

      <VendorCheckboxGroupField
        fieldKey="vendorCategory"
        label="Vendor category (select all that apply)"
        options={VENDOR_CATEGORY_OPTIONS}
        value={state.vendorCategory}
        onChange={(v) => onFieldChange('vendorCategory', v)}
        disabled={disabled}
        required
      />
      <VendorFormField
        fieldKey="productDescription"
        label="Brief description of products/plants to be sold"
        htmlType="textarea"
        value={state.productDescription}
        onChange={(v) => onFieldChange('productDescription', v)}
        disabled={disabled}
        required
      />
      <VendorFormField
        fieldKey="phytosanitaryPermitNumber"
        label="Phytosanitary certificate / import permit number (rare, exotic or imported plants)"
        htmlType="text"
        value={state.phytosanitaryPermitNumber}
        onChange={(v) => onFieldChange('phytosanitaryPermitNumber', v)}
        disabled={disabled}
        required={false}
        placeholder="Permit reference number, if issued"
      />
      <VendorFormField
        fieldKey="citesPermitNumber"
        label="CITES permit number (if selling CITES-listed/protected species)"
        htmlType="text"
        value={state.citesPermitNumber}
        onChange={(v) => onFieldChange('citesPermitNumber', v)}
        disabled={disabled}
        required={false}
        placeholder="Permit reference number, if issued"
      />
      {isFoodRetailer(state) ? (
        <VendorFormField
          fieldKey="foodHandlingCertificateNumber"
          label="Food handling / health certificate number (food retailers only)"
          htmlType="text"
          value={state.foodHandlingCertificateNumber}
          onChange={(v) => onFieldChange('foodHandlingCertificateNumber', v)}
          disabled={disabled}
          required={false}
          placeholder="Certificate reference number"
        />
      ) : null}
      {isFoodRetailer(state) ? (
        <VendorFormField
          fieldKey="foodItemList"
          label="List of food items to be sold (food retailers only)"
          htmlType="textarea"
          value={state.foodItemList}
          onChange={(v) => onFieldChange('foodItemList', v)}
          disabled={disabled}
          required={false}
        />
      ) : null}
    </div>
  );
}
