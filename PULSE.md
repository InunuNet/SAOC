# Pulse Monitoring System

The Pulse system is an automated background task runner that monitors project health, triages external signals (like GitHub issues), and initiates maintenance tasks.

## Architecture

Pulse follows a **Registry -> Inbox -> Backlog** workflow:

1.  **Runner (`execution/pulse_runner.sh`):** A background process (triggered by `launchd` or `cron`) that iterates through all executable scripts in the registry.
2.  **Registry (`.agent/pulse/registry/`):** A collection of specialized scripts that perform monitoring or maintenance (e.g., `check_github.sh`, `auto_fix_issues.sh`).
3.  **Inbox (`.agent/memory/project/inbox/`):** The landing zone for pulse job outputs. Each run generates a timestamped `.txt` file containing the job's findings or status.
4.  **Ingestion (`execution/ingest_pulse.sh`):** A script that processes the inbox, extracting key summaries and appending them as actionable items to the project's backlog.
5.  **Backlog (`.agent/memory/project/backlog.md`):** The final destination where inbox items become tasks for human or autonomous agents to address.

## Managing Pulse

- **Status:** View the latest pulse run status using `./execution/get_pulse_status.sh`.
- **Manual Run:** You can trigger a full pulse cycle manually by running `bash execution/pulse_runner.sh`.
- **Logs:** Detailed execution logs are stored in `pulse.log` at the project root.

## Registry Jobs

- `check_github.sh`: Polls the GitHub repository for new issues and adds them to the inbox.
- `auto_fix_issues.sh`: Identifies open issues on GitHub and spawns autonomous `gemini` agents to attempt fixes.
- `auto_update.sh`: Monitors for template updates and prepares checkpoints for `make update-template`.

## Troubleshooting

- **Missing CLI Tools:** Pulse requires `gh` and `jq`. Ensure they are in your PATH.
- **Lock Files:** `auto_fix_issues.sh` uses `.lock` files in `.agent/pulse/registry/processing/` to prevent duplicate agent runs. If a job is stuck, check this directory.
- **Inbox Overflow:** If items are not appearing in the backlog, ensure `ingest_pulse.sh` is being executed (it is integrated into `pulse_runner.sh`).
