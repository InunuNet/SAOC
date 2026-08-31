import {
  isCitesPermitNumberFieldApplicable,
  isFoodRetailer,
  isImportCountryOfOriginFieldApplicable,
  isLivePlantTypesFieldApplicable,
  isLivePlantTypesOtherFieldApplicable,
  type VendorRegisterFieldChangeHandler,
  type VendorRegisterFormState,
} from '@/lib/vendor-register-form-payload';
import { VendorFormField } from './VendorFormField';
import { VendorCheckboxGroupField } from './VendorCheckboxGroupField';
import { VendorBooleanRadioField } from './VendorBooleanRadioField';

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

const LIVE_PLANT_TYPE_OPTIONS = [
  { value: 'orchids', label: 'Orchids' },
  { value: 'other-plants', label: 'Other Plants' },
  { value: 'bulbs-tubers', label: 'Bulbs / Tubers' },
  { value: 'seeds', label: 'Seeds' },
  { value: 'cut-flowers', label: 'Cut Flowers' },
  { value: 'tissue-culture', label: 'Tissue Culture' },
  { value: 'other', label: 'Other' },
];

const YES_NO_OPTIONS = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
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
      <VendorBooleanRadioField
        fieldKey="sellsLivePlants"
        label="Will you be selling live plants?"
        options={YES_NO_OPTIONS}
        value={state.sellsLivePlants}
        onChange={(v) => onFieldChange('sellsLivePlants', v)}
        disabled={disabled}
        required={false}
      />
      {isLivePlantTypesFieldApplicable(state) ? (
        <VendorCheckboxGroupField
          fieldKey="livePlantTypes"
          label="Live plant types (select all that apply)"
          options={LIVE_PLANT_TYPE_OPTIONS}
          value={state.livePlantTypes}
          onChange={(v) => onFieldChange('livePlantTypes', v)}
          disabled={disabled}
          required={false}
        />
      ) : null}
      {isLivePlantTypesFieldApplicable(state) && isLivePlantTypesOtherFieldApplicable(state) ? (
        <VendorFormField
          fieldKey="livePlantTypesOther"
          label="Other live plant type (please specify)"
          htmlType="text"
          value={state.livePlantTypesOther}
          onChange={(v) => onFieldChange('livePlantTypesOther', v)}
          disabled={disabled}
          required={false}
          maxLength={100}
        />
      ) : null}
      <VendorBooleanRadioField
        fieldKey="plantsImportedForEvent"
        label="Are any plants imported specifically for this event?"
        options={YES_NO_OPTIONS}
        value={state.plantsImportedForEvent}
        onChange={(v) => onFieldChange('plantsImportedForEvent', v)}
        disabled={disabled}
        required={false}
      />
      {isImportCountryOfOriginFieldApplicable(state) ? (
        <VendorFormField
          fieldKey="importCountryOfOrigin"
          label="Country of origin for imported plants"
          htmlType="text"
          value={state.importCountryOfOrigin}
          onChange={(v) => onFieldChange('importCountryOfOrigin', v)}
          disabled={disabled}
          required={false}
          maxLength={200}
        />
      ) : null}
      <VendorBooleanRadioField
        fieldKey="citesListedSpecies"
        label="Do you sell CITES-listed / protected species?"
        options={YES_NO_OPTIONS}
        value={state.citesListedSpecies}
        onChange={(v) => onFieldChange('citesListedSpecies', v)}
        disabled={disabled}
        required={false}
      />
      {isCitesPermitNumberFieldApplicable(state) ? (
        <VendorFormField
          fieldKey="citesPermitNumber"
          label="CITES permit number"
          htmlType="text"
          value={state.citesPermitNumber}
          onChange={(v) => onFieldChange('citesPermitNumber', v)}
          disabled={disabled}
          required={false}
          placeholder="Permit reference number, if issued"
          maxLength={100}
        />
      ) : null}
      <VendorFormField
        fieldKey="phytosanitaryPermitNumber"
        label="Phytosanitary certificate / import permit number (rare, exotic or imported plants)"
        htmlType="text"
        value={state.phytosanitaryPermitNumber}
        onChange={(v) => onFieldChange('phytosanitaryPermitNumber', v)}
        disabled={disabled}
        required={false}
        placeholder="Permit reference number, if issued"
        maxLength={100}
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
    </div>
  );
}
