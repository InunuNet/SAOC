// Pure decision for the --live-reads positive control (m3-f4 Codex finding P2): a cached read must
// be SEEN on request one and ABSENT on request two. Absent on both means the read is missing or
// renamed, and would otherwise pass vacuously.

// Returns the failure messages for one control read; an empty list is a pass.
export function judgeCachedControl(name, firstCount, secondCount) {
  const failures = [];
  if (firstCount < 1) {
    failures.push(`positive control ${name} never appeared on the first request (read missing or renamed; control is vacuous)`);
  }
  if (secondCount !== 0) {
    failures.push(`second request serves ${name} from cache (got ${secondCount} request(s))`);
  }
  return failures;
}
