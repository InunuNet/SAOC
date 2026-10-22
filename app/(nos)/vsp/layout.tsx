import { NosThemeScope } from '@/components/nos/NosThemeScope';

// /vsp renders the vendor stand-payment status page, which belongs to the show tree; it wears the
// same `.nos-theme` scope as /national-show/* and /tickets/*.
export default function VspLayout({ children }: { children: React.ReactNode }) {
  return <NosThemeScope>{children}</NosThemeScope>;
}
