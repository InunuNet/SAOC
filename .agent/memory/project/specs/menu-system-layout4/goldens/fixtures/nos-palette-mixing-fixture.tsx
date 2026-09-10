// NEGATIVE FIXTURE for check-no-nos-palette-mixing.mjs -- a chrome-shaped snippet carrying
// NOS's own --primary hex value (#211a57, confirmed on origin/nos-site:app/(marketing)/
// national-show/nos-theme.css) instead of SAOC's #384138. Proves the shared palette guard
// actually rejects an NOS value if one leaks into SAOC chrome, rather than only checking
// that SOME hex string is present.
export function BrokenTrigger() {
  return <button style={{ color: '#211a57' }}>National Show</button>;
}
