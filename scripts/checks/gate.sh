#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p .local
port="${MERCATURE_PORT:-4173}"
export MERCATURE_PORT="$port"
origin="http://127.0.0.1:${port}"
if node --input-type=module -e "try { await fetch('${origin}'); process.exit(0); } catch { process.exit(1); }"; then
  echo "Stop the Mercature preview on port ${port} before running the full gate." >&2
  exit 1
fi
npm run build
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port "$port" --strictPort &
preview_pid=$!
trap 'kill "$preview_pid" 2>/dev/null || true' EXIT
node --input-type=module -e "for (let n=0;n<100;n++){try {const r=await fetch('${origin}');if(r.ok)process.exit(0);}catch{} await new Promise(resolve=>setTimeout(resolve,100));}process.exit(1);"
# Run the offline check even when the suite fails, so one run reports every failure.
failed=""
npm test || failed="${failed} npm-test"
npm run test:offline || failed="${failed} test:offline"
if [ -n "$failed" ]; then
  echo "Gate failed:${failed}" >&2
  exit 1
fi
