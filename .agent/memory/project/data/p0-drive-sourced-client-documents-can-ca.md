# p0-drive-sourced-client-documents-can-ca

**P0 — Drive-sourced client documents can carry live secrets into a tracked, PUBLIC repo.**
  On 2026-09-09 Codex found plaintext email passwords in
  `docs/leeann-source/website-development-specification-v3_2026-09-06.md`, committed `1d6512cb`
  and pushed to public `InunuNet/SAOC`. See `needs-human.md` for the rotation actions.
  The design gap: `execution/drive_docx_sync.py` converts the client's Drive documents into
  `content/drive-source/`, and per `docs/drive-docx-version-export.md` the derived `content.md`
  is **tracked by design**. Nobody anticipated a client planning document containing credentials
  — which is exactly what a volunteer-run organisation's working document does contain.
  Fix: a secret scan gating anything Drive-sourced before it can be staged or committed
  (credential-shaped table rows, `password`-adjacent columns, high-entropy tokens), failing
  closed. Consider whether derived `content.md` should be tracked at all for client-supplied
  source, or kept local with only checksums and structure committed.
  `execution/` is HARNESS-owned — file upstream against `InunuNet/Athanor`, do not patch.
