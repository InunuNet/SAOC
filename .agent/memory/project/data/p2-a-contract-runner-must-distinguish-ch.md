# p2-a-contract-runner-must-distinguish-ch

**[P2] A contract runner must distinguish "check failed" from "check was never runnable."**
  Reported 2026-09-08 by the NOS session: of nine Playwright check scripts named in its contract,
  seven do not exist on disk. A runner that treats a missing script as a failure buries real
  failures in noise; one that skips it silently reports green for coverage that was never written.
  Neither is acceptable — the two states must be reported separately. Fold into F7's runner.
