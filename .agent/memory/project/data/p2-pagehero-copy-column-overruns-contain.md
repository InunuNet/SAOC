# p2-pagehero-copy-column-overruns-contain

**P2 — PageHero copy column overruns container at 2056** (2026-10-28, NOS Design beta check; queue AFTER F1c merges) — /events facts reach ~1896 and /sponsors lede ~1660 vs container right 1634. Fix: cap copy column right edge at container right. Gate: copy.right ≤ CTA right ±1 at 1440 and 2056; 480 hero lock holds; /about facts stay one row (if /about cannot hold one row inside the capped column, report to NOS Design BEFORE building).
