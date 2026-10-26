#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
exec node scripts/audio_tools.js process
