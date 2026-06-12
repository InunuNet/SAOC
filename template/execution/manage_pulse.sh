#!/bin/bash

# Define the registration file path
REG_FILE="${HOME}/.athanor/workspaces.reg"

case "$1" in
    register)
        WORKSPACE_PATH=$(pwd)
        if [ ! -f "$REG_FILE" ]; then
            touch "$REG_FILE"
        fi
        if grep -q "^${WORKSPACE_PATH}$" "$REG_FILE"; then
            echo "Workspace already registered: ${WORKSPACE_PATH}"
        else
            echo "${WORKSPACE_PATH}" >> "$REG_FILE"
            echo "Workspace registered: ${WORKSPACE_PATH}"
        fi
        ;;
    # Add other commands here if needed in the future
    *)
        echo "Usage: $0 {register}"
        exit 1
        ;;
esac