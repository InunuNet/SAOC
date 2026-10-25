#!/bin/sh
# stub: emits invalid UTF-8 on stdout and exits 1 (used by the gate-hooks proof)
printf '\377\376 not valid utf-8\n'
exit 1
