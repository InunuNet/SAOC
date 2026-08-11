# `types/index.ts` — TicketType reconciliation

Replace:

```ts
export type TicketType = 'general' | 'member' | 'vip';
```

with:

```ts
// Ticket types are no longer a hardcoded union — the council's real categories
// (adult, pensioner, child, SAOC member, exhibitor) live as `ticketType` Sanity
// documents, keyed by slug. This is a `string` on purpose: hardcoding a parallel
// TS union here would drift the moment someone adds/renames a category in Studio.
// Pre-reconciliation Firestore tickets ('general' | 'member' | 'vip') remain valid
// Ticket records under this looser type — they are simply orphaned from the current
// active ticketType catalogue, not migrated.
export type TicketType = string;
```

`Ticket.ticketType: TicketType` is unchanged in shape (still a required string field) — only
the type alias definition changes. No other field on `Ticket` changes.
