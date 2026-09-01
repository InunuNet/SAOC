import {
  isFoodRetailer,
  type VendorRegisterFieldChangeHandler,
  type VendorRegisterFormState,
} from '@/lib/vendor-register-form-payload';
import { VendorFormField } from './VendorFormField';
import { VendorCheckboxGroupField } from './VendorCheckboxGroupField';
import { VendorPermitFieldset } from './VendorPermitFieldset';

// M2 F13 (vendor-gated-registration-flow) -- Lee-Ann's 26 Aug source form, "VENDOR CATEGORY &
// PRODUCTS" section, 14-item closed set, no 'Other'. Byte-identical (value + order) to
// CATEGORY_LABELS/VENDOR_APPLICATION_CATEGORIES in VendorApplyForm.tsx -- see
// contracts/golden/vendor-gated-registration-flow-m2/README.md "Reconciling the two category
// lists." Superseded the stale 25 Aug-derived 11-item list previously here (see
// goldens/f3-ui-vendor-category-products.md for that earlier mapping, now historical).
interface VendorCategoryFieldsetProps {
  state: VendorRegisterFormState;
  onFieldChange: VendorRegisterFieldChangeHandler;
  disabled: boolean;
}

const VENDOR_CATEGORY_OPTIONS = [
  { value: 'orchids', label: 'Orchids' },
  { value: 'cites-listed-plants', label: 'CITES listed plants' },
  { value: 'indoor-plants', label: 'Indoor plants' },
  { value: 'succulents', label: 'Succulents' },
  { value: 'rare-plants', label: 'Rare plants' },
  { value: 'exotic-plants', label: 'Exotic plants' },
  { value: 'indigenous-plants', label: 'Indigenous plants' },
  { value: 'orchid-growing-supplies', label: 'Orchid growing products and supplies' },
  { value: 'greenhouse-hardware-infrastructure', label: 'Greenhouse, hardware and infrastructure' },
  { value: 'fertilisers-growing-media', label: 'Fertilisers, growing media, plant care products' },
  { value: 'books-publications', label: 'Books, publications' },
  { value: 'art', label: 'Art' },
  { value: 'ceramics', label: 'Ceramics' },
  { value: 'food-beverage-retailer', label: 'Food and beverage retailer' },
];

// M2 F14/F19 (vendor-gated-registration-flow) -- the 6-item Food Vendor certification
// checklist, labels verbatim from the 26 Aug source doc's "FOOD VENDORS" section. See the M2
// golden README's "Food certification: checklist, not blanket attestation".
const FOOD_VENDOR_CERTIFICATION_OPTIONS = [
  { value: 'mobile-coa', label: 'Mobile certificate of acceptability' },
  { value: 'perishable-foodstuff-licence', label: 'Perishable Foodstuff Licence' },
  { value: 'hawker-informal-trading-permit', label: 'Hawker/Informal Trading Permit' },
  { value: 'mobile-gas-compliance-certificate', label: 'Mobile gas certificate of compliance' },
  { value: 'fire-safety-compliance', label: 'Fire safety compliance' },
  { value: 'vehicle-fitness-certificate', label: 'Certificate of fitness for vehicles' },
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
        maxLength={2000}
      />
      <VendorPermitFieldset state={state} onFieldChange={onFieldChange} disabled={disabled} />
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
          maxLength={100}
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
          maxLength={1000}
        />
      ) : null}
      {isFoodRetailer(state) ? (
        <VendorFormField
          fieldKey="foodHealthTradingDocumentation"
          label="Food health / trading documentation (food retailers only)"
          htmlType="textarea"
          value={state.foodHealthTradingDocumentation}
          onChange={(v) => onFieldChange('foodHealthTradingDocumentation', v)}
          disabled={disabled}
          required={false}
          maxLength={500}
        />
      ) : null}
      {isFoodRetailer(state) ? (
        <VendorCheckboxGroupField
          fieldKey="foodVendorCertifications"
          label="I hereby certify that as a food vendor I have the following certifications"
          options={FOOD_VENDOR_CERTIFICATION_OPTIONS}
          value={state.foodVendorCertifications}
          onChange={(v) => onFieldChange('foodVendorCertifications', v)}
          disabled={disabled}
          required={false}
        />
      ) : null}
    </div>
  );
}
