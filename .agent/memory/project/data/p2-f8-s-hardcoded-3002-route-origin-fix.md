# p2-f8-s-hardcoded-3002-route-origin-fix

**[P2] F8's hardcoded `:3002` route-origin fix is designed but not landed** (mission
  `ticketing-complete`, F8, 2026-09-08). @architect specced the fix: a new
  `contracts/checks/_shared/verify-server-identity.mjs`, an edit to
  `verify-walkthrough-routes.mjs` to use it, a negative-control script proving the guard fires
  on a wrong-server response, and two new contract-f8.yaml assertions (A25/A26). None of the
  four are written yet. Separately, **9 other check files share the same hardcoded `:3002`
  origin exposure** (not yet enumerated by path) — the F8 fix should be the reference pattern
  for cleaning those up, not a one-off.
