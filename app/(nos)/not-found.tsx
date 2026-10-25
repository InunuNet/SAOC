import { NosThemeScope } from '@/components/nos/NosThemeScope';

import { NosPageNotFound } from './national-show/not-found';

export { metadata } from './national-show/not-found';

// A notFound() from a show route outside /national-show (tickets, vsp) renders inside the NOS chrome,
// which already owns the page's <main>, so the section goes in bare. It sits above the segment layouts
// that mount the `.nos-theme` scope, so it brings its own. national-show/not-found.tsx carries the NOS
// fallback (typographic hero, NOS copy) the whole group shares.
export default function NosNotFound() {
  return (
    <NosThemeScope>
      <NosPageNotFound />
    </NosThemeScope>
  );
}
