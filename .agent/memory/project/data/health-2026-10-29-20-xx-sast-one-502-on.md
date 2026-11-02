# health-2026-10-29-20-xx-sast-one-502-on

**[health 2026-10-29 20:xx SAST] One 502 on nos.saoc.co.za/ at 10:29:33Z (HeadlessChrome UA, cacheLookup true)**, the only ERROR in 12h; a single edge miss, no repeat. Watch for recurrence. Everything else clean: main CI 10/10 green (the failures listed are PR-branch runs fixed before merge), rollouts 12086ce4 / ec0d5c71 / 20e62c45 all SUCCEEDED+READY, beta smoke 6/6, direct-ingress invariant OK, 0 reconcile alerts in 12h. 31 stranded reserved test orders from Aug 2026 remain (known; covered by the test-data purge item, Now #1).
