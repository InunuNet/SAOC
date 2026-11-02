# 2026-10-26-from-nos-site-font-cls-0-024

(2026-10-26, from NOS Site) Font CLS 0.024 on /symposium at 768: hero-fact dd wraps on fallback, then unwraps. adjustFontFallback is already set (app/layout.tsx:20,32,42; components/nos/NosThemeScope.tsx:32,45), but next/font derives one size-adjust per family, which doesn't hold for the Karla 600/700 weights. Investigate per-weight fallback @font-face overrides, then drop NOS's scoped nowrap on .hero-fact dd (768–1279).
