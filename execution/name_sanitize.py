#!/usr/bin/env python3
"""One name dialect for the whole harness.

REQUIREMENTS.md §3 says to REUSE `init.sh`'s existing python3 Unicode sanitiser
and not to write a second dialect. This module IS that sanitiser: `workspace()`
is init.sh's `PYSANITIZE` heredoc moved here verbatim, and init.sh now calls
this file instead of carrying its own copy. `slug()` and `email()` are
documented RESTRICTIONS of `workspace()`'s output, not new dialects — they share
its `str.isalnum()` primitive and therefore its locale-independence, which is
the property init.sh's own comment says the heredoc exists to protect
(DECISIONS.md D-G3).

NOT `tr -cd '[:alnum:]'`. tr's `[:alnum:]` is LOCALE-DEPENDENT: on a UTF-8 host
it keeps accented letters, under the C locale it keeps ASCII only. Same folder
name, two answers, decided by an environment variable nobody set on purpose.
`str.isalnum()` is Unicode-defined and gives one answer on every host.

Three derivations:

    workspace(raw)  the project name. `isalnum()` plus `_ . -` and space,
                    capped at 128 BYTES. Unchanged behaviour.
    slug(raw)       the GitHub repository name. ASCII-fold, keep
                    [A-Za-z0-9._-], collapse anything else to a single `-`,
                    collapse runs of `-`, trim leading/trailing `-`, cap at
                    GitHub's own 100-character limit.
    email(raw)      the plus-address local part. ASCII-fold, keep
                    [A-Za-z0-9]. Case preserved, so PascalCase survives.
                    Capped so the ASSEMBLED local part still fits RFC 5321's
                    64 octets.

A derivation that empties has NO usable answer: `brad+@inunu.net` silently
mis-attributes every commit on a shared remote, and a repository called `-` is
not a repository. The CLI prints nothing and exits 3 in that case; callers
REFUSE rather than substitute.

Both derivations are MANY-TO-ONE, and that is not a defect to be hidden — it is
a property callers have to surface. `SAOC Design` and `SAOC/Design` both fold to
`SAOCDesign`, as do `résumé` and `resume`; two such projects would share one
plus-address and every commit on a shared remote would be attributed to the
wrong agent, which is the exact failure §3's per-project address exists to
prevent. `is_lossy()` answers "did this derivation drop anything?" so the
caller can say so at the one moment a human is authorising the name. A
disambiguating suffix is NOT added here: the local part must remain a
contiguous run of the folded name (the property the F1A1 battery reads off
REQUIREMENTS §3), and a hash suffix is not one.

CLI:  name_sanitize.py {workspace|slug|email} <raw-name>
"""

import string
import sys
import unicodedata

# Accepted outside the alphanumerics, unchanged from init.sh's heredoc.
WORKSPACE_EXTRA = "_. -"

# 128 BYTES, matching init.sh's original `head -c 128`.
MAX_WORKSPACE_BYTES = 128

# GitHub accepts these in a repository name; everything else becomes a dash.
SLUG_KEEP = frozenset(string.ascii_letters + string.digits + "._-")

# GitHub's own repository-name limit. A 128-byte project name used to derive a
# 128-character slug, which the API rejects — so the scaffold proposed a
# repository that could never be created and only found out at the last step.
MAX_SLUG_CHARS = 100

# RFC 5321 §4.5.3.1.1: a local part is at most 64 octets. The ASSEMBLED address
# is `<user>+<local>@<domain>`, so `email()` is capped against the whole local
# part, not against its own fragment: a 128-character project name used to
# produce `brad+<128 chars>@inunu.net`, a 133-octet local part that no
# conforming MTA has to accept. An address that cannot receive mail is worse
# than no per-project address at all — it fails silently, at delivery time,
# long after the commit it was supposed to attribute.
MAX_EMAIL_LOCAL_PART = 64

RC_EMPTY = 3
RC_USAGE = 2

_MODES = ("workspace", "slug", "email")


def workspace(raw: str) -> str:
    """init.sh's project-name sanitiser, verbatim.

    Truncating the ENCODED form and decoding with errors="ignore" drops a
    partial trailing character rather than emitting invalid UTF-8 into
    WORKSPACE.
    """
    kept = "".join(c for c in raw if c.isalnum() or c in WORKSPACE_EXTRA)
    return kept.encode("utf-8")[:MAX_WORKSPACE_BYTES].decode("utf-8", "ignore")


def ascii_fold(text: str) -> str:
    """Compatibility-decompose and keep only ASCII.

    NFKD splits `é` into `e` + U+0301 and maps fullwidth forms onto their ASCII
    equivalents; the codepoint filter then drops the combining marks (which are
    all above U+007F) along with anything that has no ASCII form at all.
    """
    return "".join(c for c in unicodedata.normalize("NFKD", text) if ord(c) < 128)


def slug(raw: str, limit: int = MAX_SLUG_CHARS) -> str:
    """The GitHub repository name derived from the project name.

    Truncation happens LAST and the dash trim is re-applied after it, so a cut
    that lands mid-run cannot leave the trailing dash GitHub rejects.
    """
    folded = ascii_fold(workspace(raw))
    out = []
    for char in folded:
        out.append(char if char in SLUG_KEEP else "-")
    collapsed = []
    for char in "".join(out):
        if char == "-" and collapsed and collapsed[-1] == "-":
            continue
        collapsed.append(char)
    trimmed = "".join(collapsed).strip("-")
    if limit > 0:
        trimmed = trimmed[:limit].strip("-")
    return trimmed


def email(raw: str, budget: int = MAX_EMAIL_LOCAL_PART) -> str:
    """The plus-address local part derived from the project name.

    An SMTP local part is ASCII; a plus-address is only useful if mail actually
    arrives. Case is preserved so `Scaf Test` yields `ScafTest`.

    `budget` is how many characters the CALLER has left after its own mailbox
    and the `+` — `git_provision.py` passes `64 - len("brad") - 1`. Truncation
    is a plain prefix cut, which keeps the result a contiguous run of the folded
    name; it also makes two long names that share a prefix collide, which
    `is_lossy()` reports rather than hides.
    """
    kept = "".join(c for c in ascii_fold(workspace(raw)) if c.isalnum())
    return kept[:budget] if budget > 0 else ""


def is_lossy(raw: str, budget: int = MAX_EMAIL_LOCAL_PART) -> bool:
    """Did deriving the plus-address drop anything from the project name?

    True means the derivation is many-to-one HERE: some other project name
    folds to the same local part, so the address does not identify this project
    on its own. `ProbeProj` is lossless; `SAOC Design`, `SAOC/Design`, `résumé`
    and a 200-character name are all lossy and all collide with something.
    """
    return email(raw, budget) != raw


def main(argv: list) -> int:
    if len(argv) != 2 or argv[0] not in _MODES:
        print(
            "usage: name_sanitize.py {%s} <raw-name>" % "|".join(_MODES),
            file=sys.stderr,
        )
        return RC_USAGE
    mode, raw = argv
    value = {"workspace": workspace, "slug": slug, "email": email}[mode](raw)
    # Whitespace alone is not a name either — `workspace(" ")` is `" "`, which
    # scaffolds a workspace with an empty-looking identity at rc=0.
    if not value.strip():
        return RC_EMPTY
    sys.stdout.write(value + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
