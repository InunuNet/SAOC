# Reboot Context
_Generated: 2026-08-24T11:43Z_

## What happened last session
admin-settings-deploy-and-chrome-fix: Fix /admin/settings: deploy to Firebase App Hosting (currently 404 on beta), add missing site chrome (UtilityBar/Header/AdminNav) to match every other admin page, and add a capability-gated nav link in AdminNav.buildLinks(). Root cause: F1's dev/QA chain never opened the page in a real browser.
