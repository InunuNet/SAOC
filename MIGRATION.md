# Migration Guide: From DarkFact to Athanor

This guide outlines the steps to transition your existing projects from the DarkFact framework to Athanor.

## 1. Update Project Template

Athanor uses a new template structure. To ensure your project is up-to-date with the latest Athanor conventions and features, you should update your project's template files. This process also integrates the new **PULSE** infrastructure, which enhances job management, safety via the Inbox pattern, and token-limit control.

Run the following command in your project's root directory:

```bash
make self-update
```

This command will:
*   Synchronize core framework files.
*   Update agent configurations.
*   Ensure compatibility with new Athanor features.
*   Integrate the PULSE modular job registry and associated tooling. For details, see [.agent/reference/PULSE.md](.agent/reference/PULSE.md).

**Note:** Review any changes carefully, especially if you have made customizations to your `template/` directory.

## 2. Update Shell Aliases and Environment Variables

If you have previously configured shell aliases or environment variables specific to DarkFact, you will need to update them to reflect the Athanor naming.

Common updates may include:
*   Changing `darkfact` to `athanor` in your aliases.
*   Updating paths that reference `darkfact` to `athanor`.
*   Reviewing any custom scripts that might rely on the old naming convention.

**Example (bash/zsh):**

Old alias:
```bash
alias darkfact_dev="cd ~/projects/darkfact_project && darkfact run"
```

New alias:
```bash
alias athanor_dev="cd ~/projects/athanor_project && athanor run"
```

Please consult your shell's documentation for managing aliases and environment variables.

## 3. Verify Your Setup

After completing the migration steps, verify that your Athanor project is working as expected by running your usual development and testing workflows.

```bash
/boot
/test
```
