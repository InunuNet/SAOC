# p1-brad-only-2026-10-29-sanity-api-plan

**[P1, Brad-only, 2026-10-29] Sanity API plan quota exhausted (`plan_limit_reached`) until the 1 Nov reset.** Beta NOS hero shows "Dates to be confirmed" and every live Sanity read fails. Brad: wait for reset. Add a Sanity-quota probe to hc.sh (one live GROQ ping, alert on plan_limit_reached) so this is caught before a visitor sees it.
