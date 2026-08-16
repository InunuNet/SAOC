# PayFast documented algorithms — verbatim, fetched 2026-08-15

Source: `curl -s http://localhost:7077/https://developers.payfast.co.za/docs` (Alembic).
Confirmed reachable and current at fetch time.

## Outbound checkout signing (docs "Step 2: Create security signature")

```php
function generateSignature($data, $passPhrase = null) {
    $pfOutput = '';
    foreach( $data as $key => $val ) {
        if($val !== '') {
            $pfOutput .= $key .'='. urlencode( trim( $val ) ) .'&';
        }
    }
    $getString = substr( $pfOutput, 0, -1 );
    if( $passPhrase !== null ) {
        $getString .= '&passphrase='. urlencode( trim( $passPhrase ) );
    }
    return md5( $getString );
}
```

Rules: attribute-insertion order (NOT alphabetical), **skip any field whose value is `''`**,
**trim() every value before encoding**, `urlencode()` (uppercase hex), append
`&passphrase=urlencode(trim($passphrase))` only if a passphrase is configured.

This is what `lib/payfast.ts`'s existing `buildPayfastParamString` / `generateSignature`
implement, and it is CORRECT for the outbound path — PayFast has been accepting these
checkout signatures (evidence: payments complete, ITNs do arrive). **Do not change this
behaviour or these functions' semantics.**

## Inbound ITN verification (docs "Step 4.3: Conduct security checks" → "Verify the signature")

```php
// Posted variables from ITN
$pfData = $_POST;
foreach( $pfData as $key => $val ) {
    $pfData[$key] = stripslashes( $val );
}
// Convert posted variables to a string
foreach( $pfData as $key => $val ) {
    if( $key !== 'signature' ) {
        $pfParamString .= $key .'='. urlencode( $val ) .'&';
    } else {
        break;
    }
}
$pfParamString = substr( $pfParamString, 0, -1 );

function pfValidSignature( $pfData, $pfParamString, $pfPassphrase = null ) {
    if($pfPassphrase === null) {
        $tempParamString = $pfParamString;
    } else {
        $tempParamString = $pfParamString.'&passphrase='.urlencode( $pfPassphrase );
    }
    $signature = md5( $tempParamString );
    return ( $pfData['signature'] === $signature );
}
```

Rules: **posted (received) order** — not re-sorted, not the outbound insertion order —
**no blank-skip** (every posted field is included, even `''`), **no `trim()`** anywhere
(neither on values nor on the passphrase), `urlencode()` directly on the raw posted value,
stop before (do not include) the `signature` field itself.

**Hypothesis in the task brief is CONFIRMED, verbatim, by the current docs.** The project's
`buildPayfastParamString` (trim + skip-blank) is being reused for this inbound path
(`app/api/tickets/itn/route.ts:89` via `generateSignature`), which recomputes a digest
PayFast's real ITN payloads — which always contain multiple blank fields
(`name_last`, `custom_str1..5`, `custom_int1..5`, frequently `item_description`) — can
never match. This is sufficient on its own to explain both logged rejections
(`[tickets/itn] Signature mismatch — rejecting ITN` at 17:27:46Z and 17:28:36Z on
2026-08-15) without needing any other cause.

## Server-confirm (docs "Perform a server request to confirm the details")

The docs' own end-to-end example (`$check1 = pfValidSignature($pfData, $pfParamString); ...
$check4 = pfValidServerConfirmation($pfParamString, $pfHost);`) passes the **exact same**
`$pfParamString` built in Step 4.3 (no trim, no blank-skip, posted order) as the POST body
to `/eng/query/validate`. There is only one inbound param string in PayFast's own design —
the project's separate reuse of the outbound builder for this call
(`app/api/tickets/itn/route.ts:193`) has the identical defect as the signature check.
