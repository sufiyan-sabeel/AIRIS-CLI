#!/usr/bin/env bash
# AIRIS R Analytics Wrapper
# Bridges AIRIS CLI with R log analysis tools.
# Usage: airis-r-analyze.sh --input <logfile> [--json <out.json>] [--csv <out.csv>]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
R_SCRIPT="$PROJECT_ROOT/tools/r/airis.analytics/scripts/analyze_logs.R"

# Check R availability
if ! command -v Rscript &>/dev/null; then
  echo "Error: R is not installed. Install R >= 4.0 to use analytics tools." >&2
  echo "  See: https://www.r-project.org/" >&2
  exit 1
fi

# Check required R packages
R_PKGS_OK=$(Rscript -e 'invisible(lapply(c("jsonlite","stats"), require, character.only=TRUE))' 2>/dev/null; echo $?)
if [ "$R_PKGS_OK" -ne 0 ]; then
  echo "Warning: Required R packages (jsonlite) may not be installed." >&2
  echo "  Run: Rscript -e \"install.packages('jsonlite')\"" >&2
fi

export AIRIS_R_PACKAGE_DIR="$PROJECT_ROOT/tools/r/airis.analytics"

exec Rscript "$R_SCRIPT" "$@"
