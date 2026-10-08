Review this change for bugs and regressions. Rule (no-invention): every word on the site must trace to Lee-Ann's Drive copy; text not in her copy must not be on the site. The removed paragraph ('SAOC focuses on orchids in cultivation... visit our partner organisation WOSA') appears nowhere in her copy; her own WOSA sentences must stay. Section A is her About-page source text; section B the golden; section C the diff. Check: only the uncited block and its comment were removed, nothing of hers was lost, nothing else changed, and the JSX remains valid.

=== A. LEE-ANN SOURCE: 2.1 About - 2027 National Show v1.1 ===
**About**

**2027 South African National Orchid Show**

The 2027 South African National Orchid Show is the South African Orchid Council's premier triennial event, bringing together orchid enthusiasts, growers, researchers, conservationists, judges, horticultural professionals and members of the public to celebrate one of the world's most remarkable plant families.

Guided by the theme "From Wild Origins to Cultivated Excellence: The Future of Orchids," the National Show explores the relationship between orchids in their natural habitats and the future of responsible cultivation. As pressures on natural ecosystems continue to increase, understanding how orchids grow, adapt and interact within their environments has never been more important. The knowledge gained through conservation and scientific research provides the foundation for sustainable cultivation, ethical breeding programmes and the long-term future of orchid growing worldwide.

The National Show will showcase spectacular displays created by orchid societies and specialist growers from across South Africa, alongside the country's highest level of orchid judging and awards, specialist plant sales, educational exhibits, a comprehensive symposium, practical workshops and opportunities to engage with local and international experts.

An important feature of the 2027 programme will be the participation of Wild Orchids of Southern Africa (WOSA). Through presentations and collaborative sessions within the symposium, WOSA will contribute valuable insights into the ecology, conservation and study of indigenous orchids. Their involvement reflects the National Show's commitment to connecting conservation science with horticultural excellence, demonstrating how knowledge gained from orchids in the wild continues to shape responsible cultivation and the future sustainability of the orchid community.

The exhibition will also welcome leading national and international orchid vendors, giving visitors the opportunity to purchase exceptional plants, discover new hybrids and species, and engage directly with some of the world's most respected growers. The South African Orchid Council is deeply grateful to its headline sponsors and donors, whose generous support has made it possible to present a National Show of this scale and significance.

Whether you are an experienced orchid grower, a passionate gardener, a researcher, or simply discovering orchids for the first time, the 2027 National Show offers an inspiring opportunity to experience the extraordinary beauty, diversity and future potential of orchids.
=== B. GOLDEN ===
# F1 — remove the SAOC/WOSA attribution paragraph (golden)

## Governing rules

- `docs/rules/no-invention.md` — every piece of copy on the site must trace to
  Lee-Ann's Drive documents, the design handoff, or Brad's explicit
  instruction. Text that is in none of those three does not exist yet and
  must come out.
- Brad, 2026-10-08: "if Lee-Ann puts it in the docs its confirmed, if its not
  in Lee-Ann's copy its not on the site."
- Lee-Ann's copy mirror: `content/drive-source/National Show/` — e.g.
  `2. About/2.1 About - 2027 National Show/v1.1/content.md`. SAOC lead
  (saoc-85) cleared this specific removal.

**Verification note:** `content/drive-source/` is listed in `.gitignore`
(`.gitignore:144`) and does not exist inside this mission's worktree
(`.tmp/sandbox/wosa/`). The architect verified every claim below against the
copy at the main project root instead. `grep -rl` over that tree for
`SAOC focuses on orchids in cultivation`, `wildorchids.co.za`, and `WOSA is
credited as a hosted guest` returns no matches anywhere under
`content/drive-source/` — the paragraph and its justifying comment are not
Lee-Ann's copy. The About page's `2.1 About - 2027 National Show/v1.1/content.md`
does contain Lee-Ann's own WOSA sentence, confirming the distinction the dev
must preserve: her sentence stays, the invented paragraph goes.

## Scope — exactly two files, one block each

- `app/(marketing)/national-show/about/page.tsx`
- `app/(marketing)/national-show/what-to-expect/page.tsx`

No other file changes. In particular, out of scope: `components/chrome/**`
and `nav-config.ts` (SAOC lead's lane), the Footer WOSA link, the home page's
`MissionBlock`/`PartnersSection`, `/national-show/wosa-conference`, and any
styling or layout change.

## Remove (identical shape in both files)

The JSX comment immediately above the bordered attribution paragraph, and the
paragraph itself:

```tsx
{/* WOSA is credited as a hosted guest presenting within the symposium, per
    CLAUDE.md's scope boundary and docs/rules/no-invention.md — SAOC attributes and
    links out, it never authors conservation content in its own voice. */}
<p className="border-t border-rule pt-6 font-sans text-[15px] leading-relaxed text-ink/70">
  SAOC focuses on orchids in cultivation. For wild orchid identification, habitat and
  conservation, visit our partner organisation{' '}
  <a
    href="https://wildorchids.co.za"
    target="_blank"
    rel="noopener noreferrer"
    className="inline-link"
  >
    Wild Orchids of Southern Africa (WOSA)
  </a>
  .
</p>
```

(The exact comment wording differs by one word between the two files — "and"
vs no "and" before "links out" — grep on the shared substring
`WOSA is credited as a hosted guest`, not on the full comment text.)

Leave exactly one blank line between the preceding `</p>` and the following
`<p>` where the removed block used to sit — do not leave a double blank line,
do not collapse the surrounding paragraphs together.

## Keep, byte-identical — do NOT touch

Lee-Ann's own WOSA sentences, which ARE in her copy and must survive untouched:

- About page: `An important feature of the 2027 programme will be the
  participation of Wild Orchids of Southern Africa (WOSA)...`
- What-to-expect page: `Integrated throughout the symposium, presentations by
  Wild Orchids of Southern Africa (WOSA) will highlight the ecology and
  conservation of indigenous orchids...`

Everything else in both files — imports, surrounding paragraphs, metadata,
styling — stays byte-identical to `047d610e`.

## Pass/fail shape

PASS: both files lose the comment + paragraph + `wildorchids.co.za` link;
both files keep Lee-Ann's WOSA sentence untouched; `git diff --name-only
047d610e` touches only these two files; `pnpm run type-check` and `pnpm run
lint` are clean.

FAIL: the attribution text or comment survives in either file; Lee-Ann's own
WOSA sentence is altered or removed; any file outside the two page files
changes; type-check or lint breaks.

=== C. DIFF 047d610e..HEAD (app only) ===
diff --git a/app/(marketing)/national-show/about/page.tsx b/app/(marketing)/national-show/about/page.tsx
index fef876ed..8e05ff0f 100644
--- a/app/(marketing)/national-show/about/page.tsx
+++ b/app/(marketing)/national-show/about/page.tsx
@@ -60,23 +60,6 @@ export default function NationalShowAboutPage() {
           shape responsible cultivation and the future sustainability of the orchid community.
         </p>
 
-        {/* WOSA is credited as a hosted guest presenting within the symposium, per
-            CLAUDE.md's scope boundary and docs/rules/no-invention.md — SAOC attributes and
-            links out, it never authors conservation content in its own voice. */}
-        <p className="border-t border-rule pt-6 font-sans text-[15px] leading-relaxed text-ink/70">
-          SAOC focuses on orchids in cultivation. For wild orchid identification, habitat and
-          conservation, visit our partner organisation{' '}
-          <a
-            href="https://wildorchids.co.za"
-            target="_blank"
-            rel="noopener noreferrer"
-            className="inline-link"
-          >
-            Wild Orchids of Southern Africa (WOSA)
-          </a>
-          .
-        </p>
-
         <p className="font-sans text-[16px] leading-relaxed text-ink/80">
           The exhibition will also welcome leading national and international orchid vendors,
           giving visitors the opportunity to purchase exceptional plants, discover new hybrids
diff --git a/app/(marketing)/national-show/what-to-expect/page.tsx b/app/(marketing)/national-show/what-to-expect/page.tsx
index 649595f7..9275745e 100644
--- a/app/(marketing)/national-show/what-to-expect/page.tsx
+++ b/app/(marketing)/national-show/what-to-expect/page.tsx
@@ -110,23 +110,6 @@ export default async function WhatToExpectPage() {
           the long-term future of orchids.
         </p>
 
-        {/* WOSA is credited as a hosted guest presenting within the symposium, per
-            CLAUDE.md's scope boundary and docs/rules/no-invention.md — SAOC attributes
-            and links out, it never authors conservation content in its own voice. */}
-        <p className="border-t border-rule pt-6 font-sans text-[15px] leading-relaxed text-ink/70">
-          SAOC focuses on orchids in cultivation. For wild orchid identification, habitat and
-          conservation, visit our partner organisation{' '}
-          <a
-            href="https://wildorchids.co.za"
-            target="_blank"
-            rel="noopener noreferrer"
-            className="inline-link"
-          >
-            Wild Orchids of Southern Africa (WOSA)
-          </a>
-          .
-        </p>
-
         <p className="font-sans text-[16px] leading-relaxed text-ink/80">
           Visitors can further develop their knowledge through practical workshops, meet orchid societies from across the country,
           engage with researchers and conservationists, and discover how every aspect of the National Show reflects this
