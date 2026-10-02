#!/usr/bin/env bash
# Mise à jour sur le VPS : ./deploy.sh  (git pull, dépendances, build, redémarrage PM2)
set -euo pipefail
cd "$(dirname "$0")"
git pull --ff-only
npm ci --no-audit --no-fund
# Le cache ISR (.next/cache) peut mémoriser un 404 pour une route qui n'existait pas encore
# lors d'un build précédent ; le vider évite de resservir ce 404 après l'ajout d'une page.
rm -rf .next/cache
npm run build
pm2 restart outils-meteo
