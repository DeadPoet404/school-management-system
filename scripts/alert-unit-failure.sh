#!/usr/bin/env bash
# Invoked by jocomfy-alert@.service when a monitored unit fails.
# Reports the unit name, exit status, and a short journal tail.
#
# The journal tail is included because these units log operational
# progress only (never record contents). Scripts that could emit row-level
# data must redirect it away from stdout.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UNIT="${1:-unknown.unit}"

RESULT="$(systemctl show "$UNIT" --property=Result --value 2>/dev/null || echo unknown)"
EXIT_CODE="$(systemctl show "$UNIT" --property=ExecMainStatus --value 2>/dev/null || echo unknown)"

TAIL="$(journalctl -u "$UNIT" --no-pager --lines=12 --output=cat 2>/dev/null | tail -c 1200)"

"$ROOT/scripts/alert.sh" FAIL "Unit failed: ${UNIT}" \
  "result: ${RESULT}" \
  "exit status: ${EXIT_CODE}" \
  "" \
  "recent log:" \
  "${TAIL:-(no journal output)}"
