// NEGATIVE FIXTURE for check-style-values-sourced.mjs -- an invented 19px font size, not
// present as a font-size anywhere in either design/design_handoff_saoc/colors_and_type.css
// or .../src/styles.css's type scale (confirmed absent by grep during authoring -- unlike
// 15px, which genuinely appears as a font-size elsewhere in styles.css and so would be a
// false negative). Proves the checker rejects a size that isn't sourced, not just any size.
export function BrokenLeaf() {
  return <span className="text-[19px]">Invented size</span>;
}
