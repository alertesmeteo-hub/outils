#!/usr/bin/env bash
# Active le texte IA des cartes sur le serveur : fournisseur OpenRouter (le même que MonaNotes) et sa clé API.
#
#   bash tools/activer-texte-ia.sh
#
# La clé est demandée ici (rien ne s'affiche quand on la colle) et envoyée par ssh sur le serveur, sans passer par aucune
# ligne de commande ni apparaître à l'écran. Elle est écrite dans le .env du site (l'ancien contenu reste dans .env.bak),
# puis le site est relancé pour la lire. Modèle par défaut : google/gemini-2.5-flash-lite (changeable avec IA_MODELE).
set -euo pipefail

HOST=ubuntu@152.228.131.140

read -r -s -p "Collez la clé OPENROUTER_API_KEY puis appuyez sur Entree (rien ne s'affiche) : " VALUE
echo
if [[ -z "$VALUE" ]]; then
  echo "Rien collé : abandon." >&2
  exit 1
fi
if [[ ! "$VALUE" =~ ^[A-Za-z0-9._~+/=:-]+$ ]]; then
  echo "La valeur contient un espace, un guillemet ou un caractère inattendu : abandon (une clé d'API n'en contient pas)." >&2
  exit 1
fi

# Script exécuté sur le serveur (sans apostrophe : il passe entre apostrophes dans la commande ssh). La valeur arrive sur
# son entrée standard.
read -r -d '' REMOTE <<'EOS' || true
set -euo pipefail
IFS= read -r value
f=$HOME/outils-meteo/.env
[ -f "$f" ] || { echo "Fichier $f introuvable." >&2; exit 1; }
cp -p "$f" "$f.bak"
tmp=$(mktemp "$f.XXXXXX")
chmod --reference="$f" "$tmp"
{ grep -v -e "^IA_FOURNISSEUR=" -e "^OPENROUTER_API_KEY=" "$f" || true; printf "IA_FOURNISSEUR=openrouter\nOPENROUTER_API_KEY=%s\n" "$value"; } >"$tmp"
mv "$tmp" "$f"
[ -s ~/.nvm/nvm.sh ] && . ~/.nvm/nvm.sh
pm2 restart outils-meteo --update-env >/dev/null
echo "Texte IA active (OpenRouter) : site relance."
EOS

printf '%s\n' "$VALUE" | ssh "$HOST" "bash -l -c '$REMOTE'"
