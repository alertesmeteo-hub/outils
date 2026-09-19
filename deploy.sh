#!/usr/bin/env bash
# Mise à jour sur le VPS : ./deploy.sh  (git pull, dépendances, build, redémarrage PM2)
set -euo pipefail
cd "$(dirname "$0")"
git pull --ff-only
npm ci --no-audit --no-fund
npm run build
pm2 restart outils-meteo
