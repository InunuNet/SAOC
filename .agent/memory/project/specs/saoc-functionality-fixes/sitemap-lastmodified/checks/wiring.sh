#!/usr/bin/env bash
# Static wiring checks for sitemap-lastmodified. Usage: wiring.sh <case>. SAOC_ROOT overrides the repo root.
R="${SAOC_ROOT:-.}"
case "$1" in
  no-now-in-sitemap)
    ! grep -q 'new Date()' "$R/app/sitemap.ts" || { echo "FAIL app/sitemap.ts still uses new Date()"; exit 1; } ;;
  queries-project-updatedat)
    for q in societySlugsQuery eventSlugsQuery; do
      grep -A3 "export const $q = " "$R/sanity/queries.ts" | grep -q '_updatedAt' || { echo "FAIL $q does not project _updatedAt"; exit 1; }
    done ;;
  sitemap-uses-helper)
    grep -q 'sitemapEntry' "$R/app/sitemap.ts" && grep -q 'updatedAt' "$R/app/sitemap.ts" || { echo "FAIL app/sitemap.ts must build entries with sitemapEntry and pass updatedAt"; exit 1; } ;;
  *) echo "unknown case $1"; exit 2 ;;
esac
echo "ok $1"
