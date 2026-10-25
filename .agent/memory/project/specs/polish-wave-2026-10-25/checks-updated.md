# Pre-existing checks edited by this wave

- contracts/golden/saoc-seo-polish/sitemap-expected.json (F3): `/members` moved from `include` to
  `exclude` with a reason. The members area has no portal yet, so the sitemap no longer lists it;
  without this edit the drift guard contracts/checks/saoc-seo-polish/check-sitemap-routes.mts fails.
