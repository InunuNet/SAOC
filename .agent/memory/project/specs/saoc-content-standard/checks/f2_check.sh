#!/bin/bash
# saoc-content-standard F2 static checks. Usage: f2_check.sh <case>. Exit 0 = pass.
# Every case first requires its target file to exist, so a missing or moved file FAILS
# instead of passing a negative grep vacuously.
need() { [ -f "$1" ] || { echo "missing: $1"; exit 1; }; }
has()  { need "$1"; grep -qF -- "$2" "$1" || { echo "absent in $1: $2"; exit 1; }; }
lacks(){ need "$1"; ! grep -qF -- "$2" "$1" || { echo "still in $1: $2"; exit 1; }; }
MOI='app/(marketing)/memorandum-of-incorporation/page.tsx'
case "$1" in
  moi-page)
    has "$MOI" "title: 'Memorandum of Incorporation'"
    has "$MOI" "heading=\"Memorandum of Incorporation\""
    has "$MOI" "path: '/memorandum-of-incorporation'"
    lacks "$MOI" "Constitution"
    [ ! -e 'app/(marketing)/constitution' ] || { echo "old route dir still exists"; exit 1; } ;;
  moi-body-verbatim)
    has "$MOI" "COMPANY_DOCUMENTS"
    need content/legal/constitution.ts
    git diff --quiet origin/fix/polish-wave-2-2026-10-25 -- content/legal/constitution.ts || { echo "body copy changed"; exit 1; } ;;
  footer-saoc)
    has components/chrome/footer-data.ts "{ href: '/memorandum-of-incorporation', label: 'Memorandum of Incorporation' }"
    lacks components/chrome/footer-data.ts "label: 'Constitution'" ;;
  footer-nos)
    has components/nos-chrome/NosFooter.tsx "saocUrl('/memorandum-of-incorporation')"
    has components/nos-chrome/NosFooter.tsx ">Memorandum of Incorporation</a>"
    lacks components/nos-chrome/NosFooter.tsx ">Constitution</a>" ;;
  sitemap)
    has lib/saoc-sitemap-routes.ts "path: '/memorandum-of-incorporation'"
    lacks lib/saoc-sitemap-routes.ts "path: '/constitution'" ;;
  proxy-static)
    has proxy.ts "'/memorandum-of-incorporation'"
    has proxy.ts "'/constitution'" ;;
  redirect)
    need node_modules/.bin/tsx
    node_modules/.bin/tsx .agent/memory/project/specs/saoc-content-standard/checks/moi_redirect_probe.ts ;;
  no-constitution-label)
    # Nothing user-visible in app/ or components/ says "Constitution" any more.
    need components/chrome/footer-data.ts
    ! grep -rn --include='*.ts' --include='*.tsx' -e "Constitution" app components | grep -v "^components/nos-chrome/nos-footer-data.ts:7:" | grep -q . || { echo "Constitution label remains"; exit 1; } ;;
  expect-removed)
    need components/societies/index.ts
    [ ! -e components/societies/SocietyExpect.tsx ] || { echo "SocietyExpect.tsx still exists"; exit 1; }
    lacks components/societies/index.ts "SocietyExpect"
    lacks 'app/(marketing)/societies/[slug]/page.tsx' "SocietyExpect"
    has 'app/(marketing)/societies/[slug]/page.tsx' "SocietyDetailsCallout"
    has components/societies/index.ts "SocietyDetailsCallout"
    ! grep -rqF "Beginners welcome" app components || { echo "expect copy remains"; exit 1; } ;;
  lede-removed)
    lacks 'app/(marketing)/societies/page.tsx' "UNSOURCED_LEDE"
    lacks 'app/(marketing)/societies/page.tsx' "21 societies across South Africa"
    has 'app/(marketing)/societies/page.tsx' "SocietiesClient" ;;
  about-fallback-removed)
    lacks components/societies/SocietyAbout.tsx "one of SAOC"
    lacks components/societies/SocietyAbout.tsx "General description"
    lacks components/societies/SocietyAbout.tsx "data-placeholder"
    has components/societies/SocietyAbout.tsx "society.description" ;;
  figure-21-removed)
    lacks components/home/MissionBlock.tsx "21 societies"
    lacks components/home/MissionBlock.tsx "federated network"
    has components/home/MissionBlock.tsx "in cultivation" ;;
  figure-21-cta)
    lacks 'app/(marketing)/societies/[slug]/page.tsx' "coordinates 21 affiliated societies"
    has 'app/(marketing)/societies/[slug]/page.tsx' "CTASection" ;;
  *) echo "unknown case $1"; exit 2 ;;
esac
