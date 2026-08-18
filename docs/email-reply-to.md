# Email Reply-To Header — Resend Configuration

**Status:** Deployed. Feature complete; works with both `tickets.saoc.co.za` and `forms.saoc.co.za` sending domains.

**Purpose:** Enable recipients to reply to transactional emails by routing their replies to a working inbox, since both SAOC sending subdomains have Resend receiving deliberately disabled (send-only design).

---

## The Problem

When SAOC sends ticket confirmations from `tickets@tickets.saoc.co.za` or contact replies from `forms@forms.saoc.co.za`, a recipient who clicks Reply in their email client gets an undeliverable bounce if they try to reply — those subdomains do not receive email. The **Reply-To header** solves this by giving recipients a real address where replies actually land.

### Why Both Subdomains Have Receiving Disabled

Resend offers "Enable Receiving" as an opt-in feature. SAOC deliberately keeps it OFF on both subdomains:

- **Receiving** = Resend acts as a mail forwarder: incoming replies to `tickets@tickets.saoc.co.za` get forwarded to a webhook or forwarding address.
- **Desired instead** = A single, authorised inbox (`info@saoc.co.za`) handles all incoming mail, with explicit control over what gets stored where.

This avoids operating a mail forwarder that could silently drop replies or require webhook plumbing to handle inbound traffic. The trade-off is explicit: FROM is a dead end, so we provide a live reply address via the Reply-To header.

---

## How It Works

### Code Implementation

**File:** `lib/email.ts`

```typescript
const DEFAULT_REPLY_TO = 'info@saoc.co.za';

export function resolveReplyTo(): string {
  const raw = process.env.RESEND_REPLY_TO?.trim();
  return raw ? raw : DEFAULT_REPLY_TO;
}

export function buildEmailPayload({
  to,
  subject,
  react,
  from,
}: {
  to: string;
  subject: string;
  react: JSX.Element;
  from: string;
}): { to: string; subject: string; react: JSX.Element; from: string; replyTo: string } {
  return { to, subject, react, from, replyTo: resolveReplyTo() };
}

export async function sendEmail({
  to,
  subject,
  react,
  from,
}: {
  to: string;
  subject: string;
  react: JSX.Element;
  from: string;
}): Promise<void> {
  const { error } = await getResend().emails.send(buildEmailPayload({ to, subject, react, from }));
  if (error) throw new Error(`Resend send failed: ${error.message}`);
}
```

### Key Design Decisions

1. **Runtime resolution, not module-load time:**  
   `resolveReplyTo()` reads `process.env.RESEND_REPLY_TO` every time it's called, not once at import. This means a missing or blank env var always falls back to `DEFAULT_REPLY_TO` gracefully, never gets baked into the module as a stale value. No error is thrown — sending must never fail because a configuration variable is missing.

2. **Payload construction is pure:**  
   `buildEmailPayload()` is a pure function with no side effects — it takes input, returns a Resend-compatible payload, and does nothing else. This makes it testable and easy to reason about.

3. **External API signature unchanged:**  
   The public `sendEmail()` function signature is identical to before. All four call sites (contact form, vendor registration confirmation, vendor approval, and ticket confirmations) need zero code changes; the reply-to header is added silently inside `sendEmail()`.

4. **Field name is camelCase in Resend SDK:**  
   The Resend SDK TypeScript type uses `replyTo` (camelCase), not `reply_to`. This is the field name passed to the underlying API. The wire-level JSON key (`reply_to`) is handled by the SDK serializer — never use the snake_case version in code.

---

## Configuration

### Environment Variable

**Name:** `RESEND_REPLY_TO`  
**Scope:** Runtime (not a build secret)  
**Default:** `'info@saoc.co.za'`  
**Required:** No — if missing, blank, or whitespace-only, falls back to the default

### Where to Set It

#### Local Development

In `.env.local`:
```
RESEND_REPLY_TO="info@saoc.co.za"
```

#### Deployment (Firebase App Hosting)

In `apphosting.yaml`:
```yaml
- variable: RESEND_REPLY_TO
  value: "info@saoc.co.za"
  availability:
    - RUNTIME
```

The `RUNTIME` availability flag means the value is read at request time, not baked into the build artifact. This allows changing the reply-to address without redeploying code.

---

## Changing the Reply-To Address

To send replies to a different inbox:

1. **Identify the inbox:** Make sure the address you choose actually receives mail and someone monitors it.

2. **Update `.env.local` (local dev):**
   ```
   RESEND_REPLY_TO="support@saoc.co.za"
   ```
   Restart your local dev server (`pnpm dev`). The next email sent will use the new address.

3. **Update `apphosting.yaml` (deployed):**
   ```yaml
   - variable: RESEND_REPLY_TO
     value: "support@saoc.co.za"
     availability:
       - RUNTIME
   ```
   Commit and push to the deployment branch (typically `main`). The next build will use the new address.

4. **Verify:** Send a test email (e.g., via the contact form) and check that the recipient sees the new address in the Reply-To field.

---

## Common Traps

### Trap 1: Using Snake-Case in Code

❌ **Wrong:**  
```typescript
const payload = { to, from, subject, react, reply_to: 'info@saoc.co.za' };
```

✅ **Correct:**  
```typescript
const payload = { to, from, subject, react, replyTo: 'info@saoc.co.za' };
```

The Resend SDK uses `replyTo` (camelCase). If you use `reply_to`, the SDK silently ignores it, and the email ships without a reply-to header. Recipients won't see any reply address set — a silent failure.

### Trap 2: Hardcoding the Address Instead of Using the Env Var

❌ **Wrong:**  
```typescript
const payload = buildEmailPayload({ ..., replyTo: 'hardcoded@example.com' });
```

✅ **Correct:**  
Use `resolveReplyTo()` in `buildEmailPayload()` so the address can be changed at runtime without code changes.

### Trap 3: Throwing an Error When the Env Var Is Missing

❌ **Wrong:**  
```typescript
export function resolveReplyTo(): string {
  const raw = process.env.RESEND_REPLY_TO;
  if (!raw) throw new Error('RESEND_REPLY_TO is not set');
  return raw;
}
```

✅ **Correct:**  
Return the default silently. Email delivery is critical; a missing optional configuration variable must never break sending.

### Trap 4: Not Trimming the Env Var

❌ **Wrong:**  
```typescript
const raw = process.env.RESEND_REPLY_TO;
return raw ? raw : DEFAULT_REPLY_TO;
```

✅ **Correct:**  
```typescript
const raw = process.env.RESEND_REPLY_TO?.trim();
return raw ? raw : DEFAULT_REPLY_TO;
```

Env vars loaded from files or dashboards sometimes pick up trailing whitespace or newlines. Always trim before using.

---

## Verification

### Unit Test (Golden File)

See `.agent/memory/project/specs/reply-to-header-fix/reply-to-header-golden.ts` for the golden file test. It verifies:
- `resolveReplyTo()` returns the env var when set and non-empty
- `resolveReplyTo()` returns the default when the env var is missing or whitespace-only
- `buildEmailPayload()` includes the resolved reply-to in the payload
- The payload shape matches Resend SDK expectations

Run: `pnpm test -- email`

### Integration Test (End-to-End)

Send a test email via the contact form or ticket confirmation on local dev or staging:
1. Submit the form
2. Check the received email headers (most email clients show this under "View Message Source" or similar)
3. Verify the `Reply-To:` header shows your configured address

If the header is missing, check:
- Is `RESEND_REPLY_TO` set to a non-empty value in your env?
- Did you restart the dev server after changing `.env.local`?
- Did you rebuild and redeploy after changing `apphosting.yaml`?

---

## Related Documentation

- **[Email DNS Setup](./email-dns-setup.md)** — Resend domain verification and SPF/DKIM/DMARC records for `tickets.saoc.co.za` and `forms.saoc.co.za`
- **[Resend Integration](./payfast-integration.md)** — Overview of email sending architecture and Resend API usage (see "Email" section)
- **[Sender Addresses Reference](#)** — Lists `RESEND_FROM_TICKETS` and `RESEND_FROM_FORMS` constants and why subdomains are segregated

---

## Summary

| Aspect | Detail |
|--------|--------|
| **What** | Adds a `replyTo` header to every transactional email sent via Resend |
| **Why** | Sending subdomains have receiving disabled; FROM is a dead end, so replyTo gives replies a working address |
| **Where** | `lib/email.ts`: `resolveReplyTo()` and `buildEmailPayload()` |
| **Config** | `RESEND_REPLY_TO` env var in `.env.local` or `apphosting.yaml` |
| **Default** | `info@saoc.co.za` |
| **Change at runtime?** | Yes — no redeployment needed in Firebase App Hosting (RUNTIME flag) |
| **Tested?** | Yes — gate assertion A4 (golden file), Codex GPT-5.5 pass, end-to-end verified on sandbox |
