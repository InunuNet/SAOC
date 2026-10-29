// =============================================================
// components/site-chrome/NosThemedFrame.tsx
// The NOS chrome plus the `.nos-theme` scope, as one module. The two surfaces that serve BOTH
// sites (app/not-found.tsx and app/(shared)/layout.tsx) import it with a dynamic `import()` inside
// their NOS-host branch: a static import would put the NOS faces (Fraunces, Karla) and the NOS
// stylesheets into the CSS every SAOC route downloads (F1e), because next/font emits its
// @font-face rules with the CSS of any module in the route's static import graph.
// =============================================================

import { NosThemeScope } from '@/components/nos/NosThemeScope';
import { NosFrame } from '@/components/site-chrome/NosFrame';

export function NosThemedFrame({ children }: { children: React.ReactNode }) {
  return (
    <NosFrame>
      <NosThemeScope>{children}</NosThemeScope>
    </NosFrame>
  );
}
