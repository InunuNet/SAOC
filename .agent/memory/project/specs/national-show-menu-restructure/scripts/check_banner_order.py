#!/usr/bin/env python3
"""Assert the exhibitors page renders <PageHero>, then the "not yet open" banner
text, then <ExhibitorKeyDates>, in that order — matches spec.md's placement
instruction (banner below PageHero, above ExhibitorKeyDates)."""
import sys

PAGE = "app/(marketing)/national-show/exhibitors/page.tsx"


def main() -> int:
    src = open(PAGE, encoding="utf-8").read().lower()
    hero = src.find("<pagehero")
    banner = src.find("not yet open")
    dates = src.find("<exhibitorkeydates")

    if hero == -1 or banner == -1 or dates == -1:
        print(f"missing marker(s): hero={hero} banner={banner} dates={dates}", file=sys.stderr)
        return 1
    if not (hero < banner < dates):
        print(f"wrong order: hero={hero} banner={banner} dates={dates}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
