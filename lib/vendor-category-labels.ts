// Display labels for the vendor category slugs, as the vendor forms show them
// (components/vendors/VendorApplyForm.tsx, VendorCategoryFieldset.tsx). Admin tables use these
// instead of raw slugs; an unknown slug falls back to itself rather than disappearing.
const VENDOR_CATEGORY_LABELS: Readonly<Record<string, string>> = {
  orchids: 'Orchids',
  'cites-listed-plants': 'CITES listed plants',
  'indoor-plants': 'Indoor plants',
  succulents: 'Succulents',
  'rare-plants': 'Rare plants',
  'exotic-plants': 'Exotic plants',
  'indigenous-plants': 'Indigenous plants',
  'orchid-growing-supplies': 'Orchid growing products and supplies',
  'greenhouse-hardware-infrastructure': 'Greenhouse, hardware and infrastructure',
  'fertilisers-growing-media': 'Fertilisers, growing media, plant care products',
  'books-publications': 'Books, publications',
  art: 'Art',
  ceramics: 'Ceramics',
  'food-beverage-retailer': 'Food and beverage retailer',
};

export function vendorCategoryLabels(slugs: readonly string[]): string {
  return slugs.map((slug) => VENDOR_CATEGORY_LABELS[slug] ?? slug).join(', ');
}
