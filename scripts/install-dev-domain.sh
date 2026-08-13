#!/bin/bash
# Make https://dev.saoc.co.za (no port) reach the local Next dev server.
#
# Run ONCE, from Terminal.app:
#     cd ~/ai/SAOC && sudo bash scripts/install-dev-domain.sh
#
# It cannot run inside Claude Code: sudo needs a TTY to prompt for a password and the
# agent shell has none. That is the only reason this is a script instead of done for you.
#
# Why HTTPS and not plain HTTP: Chrome auto-upgrades typed navigations on real TLDs like
# .co.za to https://, so a plain-HTTP dev server answers with ERR_SSL_PROTOCOL_ERROR no
# matter which port it listens on. Serving real (locally-trusted) TLS is less fighting
# than trying to talk Chrome out of it.
#
# What it does, all reversible (--uninstall):
#   1. /etc/hosts                  -> 127.0.0.1 dev.saoc.co.za        (idempotent)
#   2. mkcert -install             -> trusts the local CA in the System keychain
#   3. /etc/pf.anchors/saoc-dev    -> redirects :443 and :80 to :3333 on loopback
#   4. /etc/pf.conf                -> loads that anchor                (idempotent, backed up)
#   5. LaunchDaemon                -> reapplies the pf rule at boot
#
# 443 and 80 are privileged ports, which is the whole reason root is needed. The redirect
# happens in the packet filter, so the dev server keeps running as YOU on 3333 — nothing
# is left running as root.

set -euo pipefail

DOMAIN="dev.saoc.co.za"
PORT=3333
ANCHOR_NAME="saoc-dev"
ANCHOR_FILE="/etc/pf.anchors/${ANCHOR_NAME}"
PLIST="/Library/LaunchDaemons/co.za.saoc.devredirect.plist"

# The invoking user's mkcert CA lives in their home, not root's. Without this, running
# mkcert under sudo would create a SECOND certificate authority that does not match the
# certificate already generated in .certs/ — and the browser would reject it.
REAL_USER="${SUDO_USER:-$(whoami)}"
REAL_HOME="$(eval echo "~${REAL_USER}")"
export CAROOT="${REAL_HOME}/Library/Application Support/mkcert"

if [[ "${1:-}" == "--uninstall" ]]; then
  echo "Removing dev-domain setup..."
  launchctl bootout system "$PLIST" 2>/dev/null || true
  rm -f "$PLIST" "$ANCHOR_FILE"
  sed -i '' "/${ANCHOR_NAME}/d" /etc/pf.conf 2>/dev/null || true
  sed -i '' "/${DOMAIN}/d" /etc/hosts 2>/dev/null || true
  pfctl -f /etc/pf.conf 2>/dev/null || true
  echo "Removed. The mkcert CA was left trusted — remove it with: mkcert -uninstall"
  exit 0
fi

if [[ $EUID -ne 0 ]]; then
  echo "ERROR: needs root. Run:  sudo bash scripts/install-dev-domain.sh" >&2
  exit 1
fi

# 1. hosts entry
if grep -qE "^[^#]*[[:space:]]${DOMAIN}([[:space:]]|$)" /etc/hosts; then
  echo "hosts: ${DOMAIN} already present"
else
  printf '127.0.0.1\t%s\n' "$DOMAIN" >> /etc/hosts
  echo "hosts: added 127.0.0.1 ${DOMAIN}"
fi

# 2. trust the local CA (this is the step that actually needed sudo)
if command -v mkcert >/dev/null 2>&1; then
  mkcert -install && echo "mkcert: local CA trusted (CAROOT=${CAROOT})"
else
  echo "WARNING: mkcert not on PATH; skipping CA trust. Install with: brew install mkcert" >&2
fi

# 3. pf anchor — 443 first (the one Chrome actually uses), 80 as a courtesy
cat > "$ANCHOR_FILE" <<EOF
rdr pass on lo0 inet proto tcp from any to 127.0.0.1 port 443 -> 127.0.0.1 port ${PORT}
rdr pass on lo0 inet proto tcp from any to 127.0.0.1 port 80 -> 127.0.0.1 port ${PORT}
EOF
echo "pf: wrote ${ANCHOR_FILE}"

# 4. reference it from pf.conf (rdr-anchors must precede filter rules)
if grep -q "$ANCHOR_NAME" /etc/pf.conf; then
  echo "pf.conf: anchor already referenced"
else
  cp /etc/pf.conf "/etc/pf.conf.backup-$(date +%Y%m%d%H%M%S)"
  printf 'rdr-anchor "%s"\nload anchor "%s" from "%s"\n' \
    "$ANCHOR_NAME" "$ANCHOR_NAME" "$ANCHOR_FILE" >> /etc/pf.conf
  echo "pf.conf: anchor added (original backed up)"
fi

# 5. LaunchDaemon so the redirect survives a reboot
cat > "$PLIST" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>co.za.saoc.devredirect</string>
  <key>ProgramArguments</key>
  <array>
    <string>/sbin/pfctl</string>
    <string>-E</string>
    <string>-f</string>
    <string>/etc/pf.conf</string>
  </array>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
EOF
chown root:wheel "$PLIST"; chmod 644 "$PLIST"
launchctl bootout system "$PLIST" 2>/dev/null || true
launchctl bootstrap system "$PLIST"
echo "launchd: installed ${PLIST}"

# pfctl -E writes "pf enabled" and a token to stderr on SUCCESS, so this is not an error path
pfctl -E -f /etc/pf.conf 2>&1 | sed 's/^/pfctl: /' || true

echo
echo "Done. Start the dev server with:   pnpm dev:secure"
echo "Then open:                         https://${DOMAIN}"
echo "Undo everything:                   sudo bash scripts/install-dev-domain.sh --uninstall"
