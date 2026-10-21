#!/bin/sh
# boot the lab (server + internal service) in background
cd "$(dirname "$0")/server"
[ -d node_modules ] || npm install --no-audit --no-fund
[ -d public/assets ] || { echo "frontend not built: run 'npm run build' from repo root"; }
nohup npm start > /tmp/vendora.log 2>&1 &
echo "vendora starting on http://localhost:3000 (log: /tmp/vendora.log)"
