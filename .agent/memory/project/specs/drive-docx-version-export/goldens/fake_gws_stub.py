#!/usr/bin/env python3
"""
fake_gws_stub.py -- test-only stand-in for the real `gws` CLI, used by
execution/checks/verify_drive_docx_sync_discriminator.py to drive
execution/drive_docx_sync.py against a scripted Drive world without ever
touching the real Google Drive API.

This is NOT product code and must never be installed as `gws` outside a
discriminator test's isolated PATH.

Supports exactly two read-only gws subcommand shapes, mirroring the real CLI:

  gws drive files list --params '<json with "q": "\'<parentId>\' in parents ...">'
      [--page-all]
      -> prints {"files": [...]} JSON to stdout, one entry per child of
         parentId in the scripted world (folders and files alike, matching
         the field shape the mission brief's working `gws` invocation uses:
         id, name, mimeType, size, modifiedTime, md5Checksum).

         Pagination (added post-QA hardening, see goldens/README.md gap #7):
         real Drive paginates `files.list`; `gws drive files list --page-all`
         is the client-side flag that loops pages internally and hands back
         the fully merged result. This stub takes that literally: WITHOUT
         `--page-all`, a folder with more than PAGE_SIZE children returns
         only the first page (plus a `nextPageToken`, exactly like a real
         single-page Drive response) -- so a product implementation that
         silently drops `--page-all` from its argv gets a truncated child
         list here too, and a discriminator assertion against a
         larger-than-one-page fixture folder catches it. WITH `--page-all`,
         the full child list is returned, matching what the real flag
         promises.

  gws drive files get --params '<json with "fileId": "...", "alt": "media">'
      -o <path>
      -> copies the fixture bytes registered for that fileId's
         `content_fixture` field to <path>.

         Simulated failure (added post-QA hardening, see goldens/README.md
         gap #4): if the world's node for that fileId sets `"fail_get":
         true`, this exits non-zero with a stderr message instead of
         copying bytes -- letting a discriminator fixture exercise a
         partial-failure run (file N downloads fine, file N+1's `gws get`
         fails) without needing a real network failure.

Any other subcommand (files create/update/delete/copy/emptyTrash,
permissions create/update/delete, revisions delete, etc.) is a hard, fatal
usage error here -- this stub is structurally incapable of simulating a
Drive write, on purpose, so a discriminator test that accidentally drives
the product script into attempting one fails loudly instead of the stub
quietly no-op'ing it.

World file: $FAKE_GWS_WORLD (required) -- JSON, see
goldens/fixtures/drive_world_*.json for the shape (root_id + nodes map).

Fixture bytes dir: $FAKE_GWS_FIXTURES_DIR (required for `get`) -- directory
containing the .docx bytes named by each file node's `content_fixture`.
"""
import json
import os
import re
import shutil
import sys

REFUSED_MARKER = "FAKE_GWS_REFUSED_WRITE"
SIMULATED_GET_FAILURE_MARKER = "FAKE_GWS_SIMULATED_GET_FAILURE"

# Real Drive pages results; a folder with more children than this, listed
# WITHOUT --page-all, only gets the first page back (see module docstring).
PAGE_SIZE = 2


def load_world():
    world_path = os.environ.get("FAKE_GWS_WORLD")
    if not world_path:
        print("fake_gws_stub: FAKE_GWS_WORLD not set", file=sys.stderr)
        sys.exit(2)
    with open(world_path) as f:
        return json.load(f)


def cmd_list(params_json, page_all):
    world = load_world()
    params = json.loads(params_json)
    q = params.get("q", "")
    m = re.search(r"'([^']+)'\s+in\s+parents", q)
    if not m:
        print(f"fake_gws_stub: could not parse parent id out of q={q!r}", file=sys.stderr)
        sys.exit(2)
    parent_id = m.group(1)
    node = world["nodes"].get(parent_id)
    if node is None or node.get("type") != "folder":
        print(f"fake_gws_stub: {parent_id!r} is not a known folder in the world", file=sys.stderr)
        sys.exit(2)
    all_child_ids = node.get("children", [])
    child_ids = all_child_ids if page_all else all_child_ids[:PAGE_SIZE]
    files = []
    for child_id in child_ids:
        child = world["nodes"][child_id]
        entry = {
            "id": child_id,
            "name": child["name"],
            "mimeType": child.get(
                "mimeType",
                "application/vnd.google-apps.folder" if child["type"] == "folder" else "",
            ),
        }
        if child["type"] == "file":
            entry["modifiedTime"] = child["modifiedTime"]
            entry["md5Checksum"] = child["md5Checksum"]
        files.append(entry)
    response = {"files": files}
    if not page_all and len(all_child_ids) > PAGE_SIZE:
        # A real un-paginated single-page response would carry this too --
        # present here so a wrong implementation that reads `files` but
        # ignores pagination entirely doesn't get a response that merely
        # "happens to look complete".
        response["nextPageToken"] = "simulated-more-pages-available"
    print(json.dumps(response))


def cmd_get(params_json, output_path):
    world = load_world()
    params = json.loads(params_json)
    file_id = params.get("fileId")
    if not file_id:
        print("fake_gws_stub: get requires fileId in --params", file=sys.stderr)
        sys.exit(2)
    node = world["nodes"].get(file_id)
    if node is None or node.get("type") != "file":
        print(f"fake_gws_stub: {file_id!r} is not a known file in the world", file=sys.stderr)
        sys.exit(2)
    if node.get("fail_get"):
        print(
            f"{SIMULATED_GET_FAILURE_MARKER}: world fixture sets fail_get=true for "
            f"fileId={file_id!r} -- simulating a failed Drive download (network error, "
            "revoked access, etc.) without touching any real Drive API.",
            file=sys.stderr,
        )
        sys.exit(4)
    fixtures_dir = os.environ.get("FAKE_GWS_FIXTURES_DIR")
    if not fixtures_dir:
        print("fake_gws_stub: FAKE_GWS_FIXTURES_DIR not set", file=sys.stderr)
        sys.exit(2)
    src = os.path.join(fixtures_dir, node["content_fixture"])
    if not output_path:
        print("fake_gws_stub: get requires -o <path> (binary content, no stdout dump)", file=sys.stderr)
        sys.exit(2)
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    shutil.copyfile(src, output_path)


def main(argv):
    if len(argv) < 2 or argv[0] != "drive" or argv[1] != "files":
        print(f"{REFUSED_MARKER}: only 'gws drive files <list|get>' is simulated, got: {argv}", file=sys.stderr)
        sys.exit(9)
    verb = argv[2] if len(argv) > 2 else ""
    rest = argv[3:]
    if verb == "list":
        params = None
        page_all = False
        i = 0
        while i < len(rest):
            if rest[i] == "--params" and i + 1 < len(rest):
                params = rest[i + 1]
                i += 2
                continue
            if rest[i] == "--page-all":
                page_all = True
                i += 1
                continue
            i += 1
        if params is None:
            print("fake_gws_stub: list requires --params", file=sys.stderr)
            sys.exit(2)
        cmd_list(params, page_all)
        return
    if verb == "get":
        params = None
        output_path = None
        i = 0
        while i < len(rest):
            if rest[i] == "--params" and i + 1 < len(rest):
                params = rest[i + 1]
                i += 2
                continue
            if rest[i] in ("-o", "--output") and i + 1 < len(rest):
                output_path = rest[i + 1]
                i += 2
                continue
            i += 1
        if params is None:
            print("fake_gws_stub: get requires --params", file=sys.stderr)
            sys.exit(2)
        cmd_get(params, output_path)
        return
    # Anything else -- create, update, delete, copy, emptyTrash, etc. --
    # is a simulated write attempt. Refuse loudly, never silently.
    print(f"{REFUSED_MARKER}: verb '{verb}' is a write operation, not simulated", file=sys.stderr)
    sys.exit(9)


if __name__ == "__main__":
    main(sys.argv[1:])
