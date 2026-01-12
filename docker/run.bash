#!/usr/bin/env bash
# ============================================================
# Linera Buildathon Template - run.bash
# ============================================================
# This file is kept for compatibility with the buildathon template.
# It delegates to entrypoint.sh for the full deployment flow.
#
# For manual step-by-step setup, see: /app/docker/manual-setup.sh
# ============================================================

set -eu

# Delegate to the full entrypoint script
exec bash /app/docker/entrypoint.sh
