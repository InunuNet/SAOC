#!/usr/bin/env python3
"""Test-only helper: a tiny HTTP server that mimics Alembic's health endpoint
(`GET / with Accept: application/json` -> {"version": "..."}) for F3 drift-check
fixtures. Not a check itself — used by test_skill_drift.sh to exercise the
match/mismatch cases without depending on a real Alembic proxy being up.

Usage: _mock_alembic_server.py <port> <version>
Pass the literal string GARBLED as <version> to instead serve a 200 response
with a non-JSON body — exercises verify_skill_drift.py's SKIP_RESPONSE path
(proxy reachable, but the reply can't be used), distinct from SKIP_CONNECTION
(nothing listening at all).
Serves forever until killed by the caller.
"""
import http.server
import json
import sys

PORT = int(sys.argv[1])
VERSION = sys.argv[2]
GARBLED = VERSION == "GARBLED"


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if GARBLED:
            body = b"not json at all <<<>>>"
        else:
            body = json.dumps({"version": VERSION}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args):
        pass  # keep test output quiet


if __name__ == "__main__":
    http.server.HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
