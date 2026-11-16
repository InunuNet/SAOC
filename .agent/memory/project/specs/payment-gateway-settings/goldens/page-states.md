# Golden: Payment settings page copy and state matrix

Copy rule: Brad's words are used where they exist ("Payment gateway settings", "payment gateway", "live", "sandbox"). Everything marked PROPOSED is working copy for Brad to overrule; it makes only claims the code backs. Existing strings are reused verbatim.

## Strings
| slot | text | source |
|---|---|---|
| page title / h1 / `<title>` | Payment gateway settings | Brad |
| section: gateway | Active payment gateway | existing (settings/page.tsx:130) |
| gateway helper | Customers no longer choose a gateway at checkout — this is used for every purchase. | existing |
| gateway unset error | No gateway is set — checkout will refuse purchases until one is chosen. | existing |
| gateway confirm | Switch the payment gateway to {Ozow\|PayFast}? New orders will use it. Orders already started finish on the gateway they began with. | PROPOSED (true: orders stamp `gateway`, notifications follow it) |
| section: mode | Mode | PROPOSED |
| mode options | Sandbox / Live | Brad |
| Live disabled reason (visible text) | Live is not available. Live payment credentials have not been configured, so only Sandbox can be selected. | PROPOSED (orchestrator: say credentials are not configured) |
| banner (admin-only, in page) | Sandbox: these are test payments. No real money moves. | PROPOSED |
| R0.01 option label | Charge R0.01 instead of the displayed price | PROPOSED |
| R0.01 helper | Ozow Sandbox only. This overrides the amount charged; it is not Ozow's sandbox, which is always on. PayFast is unaffected. | PROPOSED (honest: `IsTest` is already hard-true) |
| R0.01 disabled reason (gateway is PayFast) | Applies to Ozow only. | PROPOSED |
| save error | Failed to save. Please try again. | existing |
| load error | Failed to load current setting. | existing |
| recent heading | Recent changes | orchestrator |
| recent empty | No changes recorded yet. | PROPOSED |
| recent load error | Recent changes could not be loaded. | PROPOSED |
| recent row | {when} · {email} · {Active payment gateway: Ozow -> PayFast} or {R0.01 amount: Off -> On} | PROPOSED; a `null` before renders "not set" |

## State matrix
| state | gateway radios | Sandbox | Live | R0.01 | banner |
|---|---|---|---|---|---|
| loaded, gateway=ozow | Ozow selected | selected, enabled | disabled + reason | enabled | shown |
| loaded, gateway=payfast | PayFast selected | selected, enabled | disabled + reason | disabled + reason | shown |
| gateway unset (null) | none selected, error text | selected | disabled | disabled | shown |
| saving | disabled | - | disabled | disabled | shown |
| save failed | rolled back, error text | - | - | rolled back | shown |
| confirm cancelled | unchanged, no request | - | - | - | shown |
| non-owner admin | page unreachable: redirect to /admin; APIs 403 | | | | |
| signed out | redirect to /admin/login; APIs 401 | | | | |
Live is never selectable, never focusable-as-active, never submitted. Mode unknown/invalid from the server renders an error state, never "Live".
