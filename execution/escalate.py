#!/usr/bin/env python3
"""escalate.py -- ask the operator for a bounded privilege escalation, from inside the session.

  request --kind command|path --scope S --reason R [--ttl 4h]
      Writes a pending request and prints the exact AskUserQuestion to raise. The human's answer
      to that question (not the model's) is turned into a grant by the PostToolUse hook.
  status   Live grants, pending requests, or "no live permit".
  revoke   Remove the permit (narrowing, so an agent may run it).
  grant-from-answer
           The PostToolUse(AskUserQuestion) hook entry point; refuses any caller that is not a
           hook child of claude.
  grant <id>
           The operator's own fallback (a `!` line) for providers with no AskUserQuestion.

ESCALATE_OPERATOR_ONLY: `grant` and `grant-from-answer` are never an agent's commands. The
PreToolUse floor denies an agent that runs either one, and this file is floor-write-protected.
Design and threat model: docs/privileged-command-permit.md.
"""
import argparse
import json
import os
import secrets
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / "execution" / "hooks" / "lib"))
import privilege_permit as pp  # noqa: E402  (path must be set up first)
from privilege_permit import Proc, grant_fallback, grant_from_answer  # noqa: E402,F401

EXIT_OK = 0
EXIT_REFUSED = 1
MAX_PENDING = 20
MAX_REASON = 300
DEFAULT_TTL = "4h"
ASK_PREFIX = "ASKUSERQUESTION: "
FALLBACK_PREFIX = "! python3 execution/escalate.py grant "
MAX_STDIN_BYTES = 1024 * 1024
TTY_PATH = "/dev/tty"


def refuse(message):
    sys.stderr.write("escalate: refused: %s\n" % message)
    return EXIT_REFUSED


def pending_files():
    directory = pp.pending_dir(ROOT)
    if not directory.is_dir():
        return []
    return sorted(p for p in directory.glob("*.json") if pp.ID_RE.fullmatch(p.stem))


def prune_stale_pending():
    """Requests older than the grant window can never be granted; drop them before counting."""
    now = pp.utcnow()
    for path in pending_files():
        try:
            requested = pp.parse_iso(json.loads(path.read_text()).get("requested_at"))
        except (OSError, ValueError, AttributeError):
            requested = None
        age = (now - requested).total_seconds() if requested else pp.PENDING_MAX_AGE + 1
        if age > pp.PENDING_MAX_AGE:
            path.unlink(missing_ok=True)


def validate_request(args):
    """(kind, scope, reason, ttl_seconds) or raise pp.Refusal."""
    if args.kind not in ("command", "path"):
        raise pp.Refusal("--kind must be command or path")
    if not args.scope:
        raise pp.Refusal("--scope is required")
    reason = (args.reason or "").strip()
    if len(reason) < pp.MIN_REASON or len(reason) > MAX_REASON:
        raise pp.Refusal("--reason must be %d to %d characters" % (pp.MIN_REASON, MAX_REASON))
    if pp.clean(reason, MAX_REASON) != reason:
        raise pp.Refusal("--reason must be one line without control characters")
    return args.kind, pp.validate_scope(args.kind, args.scope, ROOT), reason, pp.parse_ttl(args.ttl)


def write_pending(kind, scope, reason, ttl):
    directory = pp.pending_dir(ROOT)
    directory.mkdir(parents=True, exist_ok=True)
    request_id = secrets.token_hex(4)
    while (directory / (request_id + ".json")).exists():
        request_id = secrets.token_hex(4)
    doc = {"id": request_id, "kind": kind, "scope": scope, "reason": reason, "ttl_seconds": ttl,
           "requested_at": pp.iso(pp.utcnow()), "digest": pp.digest_of(kind, scope, ttl, reason)}
    path = directory / (request_id + ".json")
    with path.open("x") as handle:
        handle.write(json.dumps(doc, indent=2) + "\n")
    path.chmod(0o600)
    return request_id


def cmd_request(args):
    try:
        kind, scope, reason, ttl = validate_request(args)
        prune_stale_pending()
        if len(pending_files()) >= MAX_PENDING:
            raise pp.Refusal("%d requests are already pending; wait or ask the operator" % MAX_PENDING)
        request_id = write_pending(kind, scope, reason, ttl)
    except pp.Refusal as exc:
        return refuse(exc)
    question = pp.question_text(request_id, kind, scope, reason, ttl)
    ask = {"header": "Escalation", "question": question, "options": ["Grant", "Deny"]}
    print("Request %s written. Raise this AskUserQuestion NOW with the question text exactly as "
          "printed (one question, options labelled exactly Grant and Deny)." % request_id)
    print("The human's answer creates the permit; you cannot. Do not paste or alter the text.")
    print("%s%s" % (ASK_PREFIX, json.dumps(ask)))
    print("%s%s" % (FALLBACK_PREFIX, request_id))
    print("(The line above is for providers with no AskUserQuestion: the operator runs it "
          "themselves with the ! prefix. Agents never run it.)")
    return EXIT_OK


def describe_grant(grant):
    what = grant["path"] if grant["kind"] == "path" else (
        ",".join(sorted(grant["commands"])) if grant["commands"] else "*")
    return "grant %s %s %s expires %s" % (grant["id"], grant["kind"], what, grant["expires_at"])


def cmd_status(_args):
    permit = pp.load_permit(ROOT)
    if permit is None:
        print("no live permit")
    else:
        print("permit granted_by %s" % permit[0])
        for grant in permit[1]:
            print(describe_grant(grant))
    for path in pending_files():
        try:
            doc = json.loads(path.read_text())
            print("pending %s %s %s ttl %s" % (doc["id"], doc["kind"], doc["scope"],
                                               pp.format_ttl(doc["ttl_seconds"])))
        except (OSError, ValueError, KeyError, TypeError):
            print("pending %s (unreadable)" % path.stem)
    return EXIT_OK


def cmd_revoke(_args):
    permit_path = ROOT / pp.PERMIT_REL
    if permit_path.is_dir() and not permit_path.is_symlink():
        return refuse("%s is a directory" % pp.PERMIT_REL)
    try:
        permit_path.unlink()
    except FileNotFoundError:
        print("no live permit")
        return EXIT_OK
    except OSError as exc:
        return refuse("cannot remove the permit (%s)" % type(exc).__name__)
    if not pp.audit_append(ROOT, "revoked", granted_by="agent:revoke"):
        sys.stderr.write("escalate: warning: revoked, but the audit log is not writable\n")
    print("permit revoked")
    return EXIT_OK


def cmd_grant_from_answer(_args):
    raw = sys.stdin.read(MAX_STDIN_BYTES)
    print("escalate: %s" % grant_from_answer(raw, ROOT))
    return EXIT_OK


def cmd_grant(args):
    """Thin wrapper over grant_fallback: open the controlling terminal (fail closed) and hand it
    over. The verdict, not an exception, decides the exit code; a refusal leaves the request."""
    try:
        tty_fd = os.open(TTY_PATH, os.O_RDWR)
    except OSError:
        return refuse("grant needs an operator terminal (%s); run it yourself with the ! prefix, "
                      "or answer the AskUserQuestion" % TTY_PATH)
    try:
        result = grant_fallback(args.id, ROOT, tty_fd=tty_fd)
    finally:
        os.close(tty_fd)
    if result != "granted":
        return refuse(result.partition(":")[2] or result)
    permit = pp.load_permit(ROOT)
    for grant in (permit[1] if permit else []):
        if grant["id"] == args.id:
            what = grant["path"] or ",".join(sorted(grant["commands"] or ["*"]))
            print("granted %s escalation for %s until %s" % (grant["kind"], what,
                                                              grant["expires_at"]))
    return EXIT_OK


def build_parser():
    parser = argparse.ArgumentParser(prog="escalate.py", description=__doc__.split("\n\n")[0])
    sub = parser.add_subparsers(dest="cmd", required=True)
    req = sub.add_parser("request", help="write a pending request and print the AskUserQuestion")
    req.add_argument("--kind")
    req.add_argument("--scope")
    req.add_argument("--reason")
    req.add_argument("--ttl", default=DEFAULT_TTL)
    req.set_defaults(func=cmd_request)
    sub.add_parser("status", help="show live grants and pending requests").set_defaults(
        func=cmd_status)
    sub.add_parser("revoke", help="remove the permit").set_defaults(func=cmd_revoke)
    sub.add_parser("grant-from-answer", help="PostToolUse hook entry point (hook only)"
                   ).set_defaults(func=cmd_grant_from_answer)
    gra = sub.add_parser("grant", help="operator fallback: grant a pending request by id")
    gra.add_argument("id")
    gra.set_defaults(func=cmd_grant)
    return parser


def main(argv):
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
