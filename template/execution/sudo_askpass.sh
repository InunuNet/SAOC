#!/bin/sh
# sudo_askpass.sh -- native password prompt for `SUDO_ASKPASS=execution/sudo_askpass.sh sudo -A <cmd>`.
# The human types the password into an OS dialog; it goes to sudo on stdout and nowhere else.
# Never copy it to a file, a log or a trace, and never run it with tracing enabled.
# Exit 1 on cancel or when no dialog tool exists.
prompt="${1:-Password required by sudo}"

if [ "$(uname -s)" = "Darwin" ]; then
  exec osascript \
    -e 'on run argv' \
    -e 'text returned of (display dialog (item 1 of argv) default answer "" with hidden answer with title "Athanor" with icon caution)' \
    -e 'end run' \
    "$prompt"
fi

if command -v zenity >/dev/null 2>&1; then
  exec zenity --password --title="Athanor" --text="$prompt"
fi
if command -v kdialog >/dev/null 2>&1; then
  exec kdialog --password "$prompt" --title "Athanor"
fi
# No dialog tool (e.g. Omarchy/Hyprland): say so, and name the route that does prompt.
echo "sudo_askpass: no password dialog (zenity or kdialog) on this host; use pkexec <cmd>, which prompts through the polkit agent, or install zenity" >&2
exit 1
