#!/bin/bash
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js is not installed. Download it from https://nodejs.org"; read; exit 1; }
[ -d node_modules ] || npm install
(sleep 2; open http://localhost:3100/admin) &
npm run noor
