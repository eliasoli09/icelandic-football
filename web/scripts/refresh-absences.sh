#!/bin/bash
# Who is unavailable, for the eight leagues Transfermarkt covers.
#
# This does not belong in the Vercel cron: it runs a Python scraper, and at a
# polite 1.5 seconds between roughly 330 requests it takes about eight minutes,
# where that function is capped at 300 seconds. It lives with the odds fetch,
# on this machine, for the same kind of reason.
#
# Each run replaces today's picture and appends it to club_absence_history, so
# a record builds up. Transfermarkt publishes no history of its own, and without
# one the cost of an absence cannot be fitted against results.
set -euo pipefail
cd "$(dirname "$0")/.."

CACHE="${TM_CACHE:-$HOME/.cache/transfermarkt}"
# mktemp creates the file it names, so appending a suffix would leave that one
# behind every run; take a directory and put the file inside it instead
WORK="$(mktemp -d -t absences)"
OUT="$WORK/absences.json"
trap 'rm -rf "$WORK" "$CACHE"' EXIT
# yesterday's pages must not be reused, or every day records the same absences
rm -rf "$CACHE"
mkdir -p "$CACHE"

TM_CACHE="$CACHE" python3 scripts/lib/tm_absences.py "$OUT"
npx tsx scripts/ingest-absences.mts "$OUT"
