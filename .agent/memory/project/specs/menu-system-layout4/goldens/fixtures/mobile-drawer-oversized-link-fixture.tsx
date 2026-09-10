// NEGATIVE FIXTURE for check-mobile-drawer-max-font-size.mjs -- a 20px mobile drawer link,
// exceeding the handoff's 17px cap (design/design_handoff_saoc/src/styles.css 371-419).
// Reproduces the exact defect class Brad reported in the earlier round ("way too big").
export function BrokenMobileLink() {
  return <a className="text-[20px]">About</a>;
}
