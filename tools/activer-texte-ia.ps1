# Active le texte IA des cartes sur le serveur : fournisseur OpenRouter (le même que MonaNotes) et sa clé API.
#
#   powershell -ExecutionPolicy Bypass -File tools\activer-texte-ia.ps1
#
# La clé est demandée ici (rien ne s'affiche quand on la colle) et envoyée par ssh sur le serveur, sans passer par aucune
# ligne de commande ni fichier. Elle est écrite dans le .env du site (l'ancien contenu reste dans .env.bak), puis le site
# est relancé pour la lire. Modèle par défaut : google/gemini-2.5-flash-lite (changeable avec IA_MODELE).

$ErrorActionPreference = 'Stop'
$hote = 'ubuntu@152.228.131.140'

$secret = Read-Host "Collez la cle OPENROUTER_API_KEY puis appuyez sur Entree (rien ne s'affiche)" -AsSecureString
$valeur = [System.Net.NetworkCredential]::new('', $secret).Password
if ([string]::IsNullOrWhiteSpace($valeur)) { Write-Host 'Rien colle : abandon.'; exit 1 }
if ($valeur -notmatch '^[A-Za-z0-9._~+/=:-]+$') { Write-Host "La valeur contient un caractere inattendu (espace, guillemet...) : abandon."; exit 1 }

# Script exécuté sur le serveur, envoyé sur l'entrée standard de ssh (la valeur, validée plus haut, ne contient aucun caractère spécial).
$corps = @'
set -euo pipefail
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
'@
$script = ("value='$valeur'`n" + $corps) -replace "`r`n", "`n"

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = 'ssh'
$psi.Arguments = "$hote `"bash -l -s`""
$psi.UseShellExecute = $false
$psi.RedirectStandardInput = $true
$proc = [System.Diagnostics.Process]::Start($psi)
$octets = (New-Object System.Text.UTF8Encoding($false)).GetBytes($script)
$proc.StandardInput.BaseStream.Write($octets, 0, $octets.Length)
$proc.StandardInput.BaseStream.Flush()
$proc.StandardInput.Close()
$proc.WaitForExit()
if ($proc.ExitCode -ne 0) { Write-Host "Echec (code $($proc.ExitCode))."; exit $proc.ExitCode }
