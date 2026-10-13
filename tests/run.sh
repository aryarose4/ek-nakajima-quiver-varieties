#!/usr/bin/env bash
# E_k Nakajima quiver-varieties battery. Copies the live widget modules next
# to the batteries (Node ESM resolves "./quiver-data.js" etc. relative to the
# importing file; tests/package.json sets type:module so Node treats the .js
# copies as ESM) and runs every battery. Exit 1 on failure.
set -e
cd "$(dirname "$0")"

SRC="../assets/js/ek-nakajima"
for f in quiver-data.js core-layout.js diagram-layout.js tree-embed.js triangle-geometry.js; do
  cp "$SRC/$f" "./$f"
done

fail=0
for f in validate-data.mjs validate-layout.mjs validate-diagram.mjs triangle-geometry.test.mjs; do
  echo "=== $f ==="
  if ! node "$f"; then
    fail=1
  fi
done

exit $fail
