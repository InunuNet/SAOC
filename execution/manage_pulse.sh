#!/bin/bash

# HOME must be a real, non-empty value: an unset or empty HOME turns
# "${HOME}/.athanor" into "/.athanor", and a privileged invocation would then
# create and write global root state instead of failing clearly.
if [ -z "${HOME:-}" ]; then
    echo "manage_pulse.sh: \$HOME is not set -- refusing to guess a registry location" >&2
    exit 1
fi

# Define the registration directory and file path. The directory is this
# tool's own declared state home, so provisioning it here is not a
# workspace-boundary crossing (workspace-owns-its-memory D3).
REG_DIR="${HOME}/.athanor"
REG_FILE="${REG_DIR}/workspaces.reg"

case "$1" in
    register)
        # The caller (init.sh) passes the workspace path explicitly as $2 --
        # trust that over $(pwd), which reports the wrong workspace whenever
        # the caller invokes this script from elsewhere (e.g. `init.sh --path
        # <elsewhere>`). Falling back to pwd only when no path is supplied.
        WORKSPACE_PATH="${2:-$(pwd)}"
        if ! mkdir -p "$REG_DIR" 2>/dev/null; then
            echo "manage_pulse.sh: cannot create ${REG_DIR}" >&2
            exit 1
        fi
        if [ ! -f "$REG_FILE" ]; then
            if ! touch "$REG_FILE" 2>/dev/null; then
                echo "manage_pulse.sh: cannot create ${REG_FILE}" >&2
                exit 1
            fi
        fi
        # Fixed-string, exact-line match -- WORKSPACE_PATH is a filesystem
        # path, not a regular expression, and grep's ERE anchors would let
        # metacharacters in the path (., *, [, etc.) match a DIFFERENT
        # registration and silently skip appending this one.
        if grep -qxF -- "$WORKSPACE_PATH" "$REG_FILE" 2>/dev/null; then
            echo "Workspace already registered: ${WORKSPACE_PATH}"
        else
            # A write that fails must not report success (D3b): guard the
            # echo behind the append it depends on.
            if echo "${WORKSPACE_PATH}" >> "$REG_FILE" 2>/dev/null; then
                echo "Workspace registered: ${WORKSPACE_PATH}"
            else
                echo "manage_pulse.sh: failed to register ${WORKSPACE_PATH}" >&2
                exit 1
            fi
        fi
        ;;
    # Add other commands here if needed in the future
    *)
        echo "Usage: $0 {register}"
        exit 1
        ;;
esac