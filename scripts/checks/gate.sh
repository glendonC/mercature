#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
if node --input-type=module -e 'try { await fetch("http://127.0.0.1:4173"); process.exit(0); } catch { process.exit(1); }'; then
  echo 'Stop the Mercature preview on port 4173 before running the full gate.' >&2
  exit 1
fi
npm run build
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort &
preview_pid=$!
trap 'kill "$preview_pid" 2>/dev/null || true' EXIT
node --input-type=module -e 'for (let n=0;n<100;n++){try {const r=await fetch("http://127.0.0.1:4173");if(r.ok)process.exit(0);}catch{} await new Promise(resolve=>setTimeout(resolve,100));}process.exit(1);'
npm test
npm run test:offline
