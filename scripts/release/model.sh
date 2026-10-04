#!/usr/bin/env bash
# Put the trimmed encoder where the build serves it from: the pinned Hub files, the trim (needs uv),
# then a check that the result is exactly what the app pins, and its MIT license beside it.
set -euo pipefail
cd "$(dirname "$0")/../.."
node scripts/language/provision.mjs
node scripts/language/trim.mjs
node scripts/release/check-model.mjs
cp licenses/multilingual-e5-small-MIT.txt public/models/multilingual-e5-small-latin-hangul/LICENSE.txt
