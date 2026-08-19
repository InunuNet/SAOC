"""
_firestore_rest.py — shared Firestore REST + Google OAuth helper for the F2/F4 purchase
and door check-in verification scripts (verify_order_paid.py, verify_checkin_audit.py,
verify_checkin_duplicate_refused.py).

Why hand-rolled REST instead of an SDK: neither `firebase_admin` nor `google-auth` is
installed in this Python environment (confirmed absent — `pip list` has neither).
`pyjwt` and `cryptography` ARE available, so this module signs the same OAuth2
service-account JWT-bearer assertion those packages build internally, exchanges it at
Google's token endpoint for an access token scoped to
`https://www.googleapis.com/auth/datastore`, and calls the Firestore v1 REST API
directly with it. This mirrors verify_autodeploy_build.py's own hand-rolled REST
approach in this same directory (there, a cached firebase-tools OAuth refresh token;
here, the Admin SDK service-account key already used by lib/firebase-admin.ts).

Credentials are read directly from .env.local — the same three vars
(FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY)
lib/firebase-admin.ts and scripts/admin-grant.ts already use. No `dotenv` package: its
startup banner has corrupted an env value on this project before (see
scripts/seed-page-singletons.ts's header comment) — reading the file with a plain
regex avoids that class of bug entirely.

Read-only: this module exposes only `get_document` (single-document fetch) and
`query_by_field` (equality query, no order-by so no composite index is required).
No create/update/delete/set/add method exists here — a verification script must never
mutate the thing it verifies.
"""

from __future__ import annotations

import re
import time
from pathlib import Path
from typing import Any

import jwt
import requests

REPO_ROOT = Path(__file__).resolve().parents[2]
ENV_LOCAL = REPO_ROOT / ".env.local"

FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore"
TOKEN_URL = "https://oauth2.googleapis.com/token"
JWT_LIFETIME_SECONDS = 3600
HTTP_TIMEOUT_SECONDS = 30


class FirestoreSetupError(Exception):
    """Raised for setup/auth failures unrelated to the defect under test — callers map
    this to exit code 2, never exit code 1 (a real FAIL)."""


def load_admin_credentials() -> tuple[str, str, str]:
    """Reads FIREBASE_ADMIN_PROJECT_ID / _CLIENT_EMAIL / _PRIVATE_KEY out of .env.local.

    The private key is stored as a real (not \\n-escaped) multi-line PEM block wrapped
    in a double-quoted value — `re.DOTALL` lets `.` cross those line boundaries; the
    match is non-greedy so it stops at the first closing quote, which is safe because a
    PEM body never itself contains a literal `"`.
    """
    if not ENV_LOCAL.exists():
        raise FirestoreSetupError(f".env.local not found at {ENV_LOCAL}")

    text = ENV_LOCAL.read_text()

    project_match = re.search(r"^FIREBASE_ADMIN_PROJECT_ID=(.*)$", text, re.MULTILINE)
    email_match = re.search(r"^FIREBASE_ADMIN_CLIENT_EMAIL=(.*)$", text, re.MULTILINE)
    key_match = re.search(r'FIREBASE_ADMIN_PRIVATE_KEY="(.*?)"', text, re.DOTALL)

    if not project_match or not project_match.group(1).strip():
        raise FirestoreSetupError("FIREBASE_ADMIN_PROJECT_ID missing or empty in .env.local")
    if not email_match or not email_match.group(1).strip():
        raise FirestoreSetupError("FIREBASE_ADMIN_CLIENT_EMAIL missing or empty in .env.local")
    if not key_match or not key_match.group(1).strip():
        raise FirestoreSetupError("FIREBASE_ADMIN_PRIVATE_KEY missing or empty in .env.local")

    return project_match.group(1).strip(), email_match.group(1).strip(), key_match.group(1)


def get_access_token(client_email: str, private_key: str) -> str:
    """Mints a short-lived OAuth2 access token via the service-account JWT-bearer flow,
    scoped to Firestore reads only."""
    now = int(time.time())
    assertion_payload = {
        "iss": client_email,
        "scope": FIRESTORE_SCOPE,
        "aud": TOKEN_URL,
        "iat": now,
        "exp": now + JWT_LIFETIME_SECONDS,
    }
    try:
        assertion = jwt.encode(assertion_payload, private_key, algorithm="RS256")
    except Exception as exc:  # malformed key, etc. — setup failure, not a real FAIL
        raise FirestoreSetupError(f"failed to sign service-account JWT: {exc}") from exc

    try:
        response = requests.post(
            TOKEN_URL,
            data={
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": assertion,
            },
            timeout=HTTP_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        raise FirestoreSetupError(f"token exchange request failed: {exc}") from exc

    if response.status_code != 200:
        raise FirestoreSetupError(
            f"token exchange failed: HTTP {response.status_code} {response.text[:300]}"
        )

    token = response.json().get("access_token")
    if not token:
        raise FirestoreSetupError("token exchange response had no access_token")
    return token


def decode_value(value: dict[str, Any]) -> Any:
    """Converts one Firestore REST typed value (e.g. {"stringValue": "x"}) to a plain
    Python value. Recurses into maps and arrays."""
    if "stringValue" in value:
        return value["stringValue"]
    if "integerValue" in value:
        return int(value["integerValue"])
    if "doubleValue" in value:
        return value["doubleValue"]
    if "booleanValue" in value:
        return value["booleanValue"]
    if "nullValue" in value:
        return None
    if "timestampValue" in value:
        return value["timestampValue"]  # RFC3339 string — string comparison sorts chronologically
    if "referenceValue" in value:
        return value["referenceValue"]
    if "mapValue" in value:
        return decode_fields(value["mapValue"].get("fields", {}))
    if "arrayValue" in value:
        return [decode_value(item) for item in value["arrayValue"].get("values", [])]
    return None


def decode_fields(fields: dict[str, dict[str, Any]]) -> dict[str, Any]:
    return {name: decode_value(value) for name, value in fields.items()}


class FirestoreClient:
    """Read-only Firestore v1 REST client. Every method here is a GET or a query POST —
    none of them can create, update, or delete a document."""

    def __init__(self, project_id: str, token: str):
        self._base = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents"
        self._headers = {"Authorization": f"Bearer {token}"}

    def get_document(self, collection: str, doc_id: str) -> dict[str, Any] | None:
        """Fetches one document by its exact id. Returns None if it does not exist
        (HTTP 404) — any other non-2xx status is a setup failure, not a "not found"."""
        url = f"{self._base}/{collection}/{doc_id}"
        try:
            response = requests.get(url, headers=self._headers, timeout=HTTP_TIMEOUT_SECONDS)
        except requests.RequestException as exc:
            raise FirestoreSetupError(f"GET {collection}/{doc_id} failed: {exc}") from exc

        if response.status_code == 404:
            return None
        if response.status_code != 200:
            raise FirestoreSetupError(
                f"GET {collection}/{doc_id} failed: HTTP {response.status_code} "
                f"{response.text[:300]}"
            )
        return decode_fields(response.json().get("fields", {}))

    def query_by_field(self, collection: str, field: str, value: str) -> list[dict[str, Any]]:
        """Runs an equality query `WHERE field == value` against `collection`.

        Deliberately no `orderBy` — an equality filter plus an order-by on a different
        field requires a composite Firestore index that may not exist yet, which would
        turn a routine verification run into a setup failure. Callers that need
        chronological order sort the (small, per-booking-ref) result set client-side by
        a timestamp field instead.

        Each returned dict also carries the document's own id under the `_id` key (decoded
        from the REST response's `document.name`, the last path segment) — a query result
        does not otherwise reveal its own document id, only its fields, and a caller may need
        it (e.g. to navigate to `/tickets/{bookingRef}` when the `bookingRef` FIELD itself is
        unset on an older fixture but the doc id — which is always the real booking ref, see
        lib/orders.ts — is not). `_id` is not a real Firestore field name in this project's
        schemas, so it cannot collide with one.
        """
        url = f"{self._base}:runQuery"
        body = {
            "structuredQuery": {
                "from": [{"collectionId": collection}],
                "where": {
                    "fieldFilter": {
                        "field": {"fieldPath": field},
                        "op": "EQUAL",
                        "value": {"stringValue": value},
                    }
                },
            }
        }
        try:
            response = requests.post(
                url, headers=self._headers, json=body, timeout=HTTP_TIMEOUT_SECONDS
            )
        except requests.RequestException as exc:
            raise FirestoreSetupError(f"query on {collection} failed: {exc}") from exc

        if response.status_code != 200:
            raise FirestoreSetupError(
                f"query on {collection} failed: HTTP {response.status_code} "
                f"{response.text[:300]}"
            )

        documents: list[dict[str, Any]] = []
        for entry in response.json():
            document = entry.get("document")
            if document:
                decoded = decode_fields(document.get("fields", {}))
                decoded["_id"] = document.get("name", "").rsplit("/", 1)[-1]
                documents.append(decoded)
        return documents


def connect() -> FirestoreClient:
    """Loads credentials from .env.local, mints an access token, and returns a ready
    FirestoreClient. Raises FirestoreSetupError on any setup/auth problem — callers
    should catch this and exit 2, never exit 1."""
    project_id, client_email, private_key = load_admin_credentials()
    token = get_access_token(client_email, private_key)
    return FirestoreClient(project_id, token)
