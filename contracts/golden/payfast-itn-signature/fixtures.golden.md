# ITN fixtures

## `sandbox-itn.raw.txt`

A realistic `application/x-www-form-urlencoded` ITN body. Field order is exactly PayFast's
documented ITN payload order (docs Step 4.2 `$ITN_Payload` array): `m_payment_id`,
`pf_payment_id`, `payment_status`, `item_name`, `item_description`, `amount_gross`,
`amount_fee`, `amount_net`, `custom_str1..5`, `custom_int1..5`, `name_first`, `name_last`,
`email_address`, `merchant_id`, `signature`. Includes the empty fields PayFast's real
sandbox notifications send blank (`item_description`, all `custom_str*`/`custom_int*`,
`name_last`) per the evidence in the task brief.

`signature` = `c6d2782c02d53ef7cf808981c8c31d43`, computed independently in Python
(`hashlib.md5`) by implementing the documented inbound algorithm directly (posted order,
no trim, no blank-skip, `urlencode()` with uppercase-hex non-alphanumerics, space→`+`) —
see the reproduction script referenced in `contract-payfast-itn-signature.yaml`. Computed
WITHOUT a passphrase (`pfPassphrase === null` branch) deliberately: the real sandbox
passphrase is a secret and must never be committed to a golden file. If
`PAYFAST_SANDBOX_PASSPHRASE` is set when the contract's assertions run, they exercise
`generateNotifySignature(fields, null)` explicitly (not the env var) so the fixture stays
reproducible independent of environment.

## `sandbox-itn-tampered.raw.txt`

Identical to `sandbox-itn.raw.txt` except `amount_gross` is changed from `250.00` to
`259.00`. The `signature` field is left UNCHANGED (still the original body's correct
signature) — this is what a real tampering/interception attempt looks like: the attacker
alters a field but does not (cannot, without the passphrase) recompute a matching
signature. Verification of this body MUST fail.
