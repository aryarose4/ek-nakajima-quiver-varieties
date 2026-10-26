#!/usr/bin/env bash
# Rebuild the light/dark LaTeX quivers. Requires Node 12+, pdflatex (TikZ,
# standalone), and pdftocairo; standalone crops each PDF without pdfcrop.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$HERE/build.mjs"
