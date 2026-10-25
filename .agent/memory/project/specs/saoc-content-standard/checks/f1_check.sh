#!/bin/bash
# saoc-content-standard F1 static checks. Usage: f1_check.sh <case>. Exit 0 = pass.
# Every case requires its target files to exist first, so a missing file FAILS rather than passing a negative grep.
need() { [ -f "$1" ] || { echo "missing: $1"; exit 1; }; }
has()  { need "$1"; grep -qF -- "$2" "$1" || { echo "absent in $1: $2"; exit 1; }; }
lacks(){ need "$1"; ! grep -qF -- "$2" "$1" || { echo "still in $1: $2"; exit 1; }; }
EVENT='app/(marketing)/events/[slug]/page.tsx'
ABOUT='app/(marketing)/about/page.tsx'
MEMBERS='app/(marketing)/members/page.tsx'
SPONSORS='app/(marketing)/sponsors/page.tsx'
JUDGING='app/(marketing)/judging/page.tsx'
MOI='app/(marketing)/memorandum-of-incorporation/page.tsx'
PRIVACY='app/(shared)/privacy/page.tsx'
TERMS='app/(shared)/terms/page.tsx'
KIT='app/(marketing)/media-kit/MediaKitPageBody.tsx'
case "$1" in
  api-facts)
    has lib/hero-facts.ts "export interface HeroFact"
    has lib/hero-facts.ts "export function normaliseHeroFacts"
    has lib/hero-facts.ts "HERO_FACTS_MIN"
    has components/ui/PageHero.tsx "facts?:"
    has components/ui/PageHero.tsx "data-hero-facts"
    has components/ui/PageHero.tsx "data-hero-fact"
    has components/ui/PageHero.tsx "data-fact-count"
    lacks lib/hero-facts.ts "TBC"
    lacks lib/hero-facts.ts "To be confirmed" ;;
  api-layout)
    has components/ui/DocumentLayout.tsx "data-doc-layout"
    has components/ui/DocumentLayout.tsx "data-doc-main"
    has components/ui/DocumentLayout.tsx "data-doc-aside"
    has components/ui/DocumentLayout.tsx "data-doc-aside-kind"
    has components/ui/DocumentIndex.tsx "'use client'"
    has components/ui/DocumentIndex.tsx 'aria-label="Sections"'
    has components/ui/DocumentIndex.tsx "data-doc-index-link"
    has app/globals.css ".doc-layout"
    has app/globals.css ".doc-prose"
    has app/globals.css ".doc-h2"
    has app/globals.css "7fr"
    has app/globals.css "5fr"
    has app/globals.css "var(--display-sm)" ;;
  routes-migrated)
    for f in "$EVENT" "$ABOUT" "$MEMBERS" "$SPONSORS" "$JUDGING" "$MOI" "$PRIVACY" "$TERMS" "$KIT"; do
      has "$f" "DocumentLayout"
      has "$f" "Breadcrumb"
    done ;;
  event-hero)
    has "$EVENT" "PageHero"
    has "$EVENT" "orchid-dark.jpg"
    has "$EVENT" "facts="
    has "$EVENT" "formatShowDateRange"
    has "$EVENT" "hostRegion"
    has "$EVENT" "ShowBand"
    lacks "$EVENT" "max-w-[860px]"
    lacks "$EVENT" "data-event-kind" ;;
  about-facts)
    has "$ABOUT" "facts="
    has "$ABOUT" "Founded, Bloemfontein"
    has "$ABOUT" "Accredited SAOC Judges, September 1968"
    has "$ABOUT" "Founding societies"
    lacks "$ABOUT" "Founding date, Bloemfontein"
    lacks "$ABOUT" "min-[889px]:font-light"
    lacks "$ABOUT" "max-w-[760px]" ;;
  judging-band-deleted)
    has "$JUDGING" "AwardsGrid"
    lacks "$JUDGING" "buildFallbackStats"
    lacks "$JUDGING" "Award Tiers"
    lacks "$JUDGING" "facts=" ;;
  mediakit-no-row)
    has "$KIT" "Quick facts"
    lacks "$KIT" "facts={"
    lacks "$KIT" "uppercase tracking-[0.22em] text-muted mb-6" ;;
  mono-labels-gone)
    lacks "$SPONSORS" "uppercase tracking-[0.22em] text-muted mb-6"
    lacks "$SPONSORS" "max-w-[720px]"
    has "$SPONSORS" "Become a sponsor"
    lacks "$MEMBERS" 'className="eyebrow"'
    lacks "$MEMBERS" "max-w-[720px]" ;;
  legal-base)
    has components/legal/LegalBody.tsx "doc-h2"
    lacks components/legal/LegalBody.tsx "text-primary"
    lacks components/legal/LegalBody.tsx "max-w-[720px]"
    has "$PRIVACY" "index="
    has "$TERMS" "index="
    lacks "$MOI" "index=" ;;
  home-date)
    has components/home/Hero.tsx "data-home-show-date"
    has components/home/Hero.tsx "formatShowDateRange"
    has components/home/Hero.tsx "showCtaLabel" ;;
  sole-heading-hack)
    # one shared class replaces the per-page weight hack
    need app/globals.css
    for d in components/about components/judging components/members components/sponsors components/legal components/events; do [ -d "$d" ] || { echo "missing dir: $d"; exit 1; }; done
    ! grep -rqF "min-[889px]:font-light" components/about components/judging components/members components/sponsors components/legal components/events "app/(marketing)/about" "app/(marketing)/judging" "app/(marketing)/members" "app/(marketing)/sponsors" || { echo "weight hack remains on a migrated route"; exit 1; } ;;
  typecheck)
    need node_modules/.bin/tsc
    node_modules/.bin/tsc --noEmit -p tsconfig.json ;;
  *) echo "unknown case $1"; exit 2 ;;
esac
