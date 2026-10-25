# Pre-existing checks edited (supersession)

- contracts/checks/vendor-form-input-focus-indicators-f1/check-a1-ring-tokens.sh: expected inputClass token
  `focus-visible:ring-ink/40` is now `focus-visible:ring-primary` (F2 spec item 3). Check kept, still passes.
- contracts/checks/vendor-form-input-focus-indicators-f1/check-a2-checkbox-radio-regression.sh: pinned checkbox and
  radio class strings changed from `h-4 w-4 ... focus:ring-ink/40` to `size-6 ... focus:ring-primary` (F2 spec items 1 and 3).
  Check kept as a regression guard on the new strings, still passes.
- contracts/golden/saoc-seo-polish/sitemap-expected.json (F3): `/members` moved from `include` to
  `exclude` with a reason. The members area has no portal yet, so the sitemap no longer lists it;
  without this edit the drift guard contracts/checks/saoc-seo-polish/check-sitemap-routes.mts fails.
