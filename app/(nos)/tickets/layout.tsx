import { NosThemeScope } from '@/components/nos/NosThemeScope';

// R62 #1 (F18b): no brand switch at payment. The ticket routes sit under the NOS chrome
// (ChromeFrame) and inside the same `.nos-theme` scope as the show pages.
export default function TicketsLayout({ children }: { children: React.ReactNode }) {
  return <NosThemeScope>{children}</NosThemeScope>;
}
