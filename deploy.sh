#!/usr/bin/env bash
# Mise à jour MANUELLE sur le VPS (secours) : git pull, dépendances, build, redémarrage PM2. Le déploiement normal se fait dans GitHub Actions (.github/workflows/deploy.yml), qui construit le site hors du VPS.
set -euo pipefail
cd "$(dirname "$0")"
git pull --ff-only
npm ci --no-audit --no-fund
# Le cache ISR (.next/cache) peut mémoriser un 404 pour une route qui n'existait pas encore
# lors d'un build précédent ; le vider (sauf le cache des prévisions) évite de resservir ce 404 après l'ajout d'une page.
# On garde le cache des prévisions (fetch-cache) : le vider à chaque mise en ligne multiplierait les appels Open-Meteo.
find .next/cache -mindepth 1 -maxdepth 1 ! -name fetch-cache -exec rm -rf {} + 2>/dev/null || true
npm run build
pm2 restart outils-meteo
