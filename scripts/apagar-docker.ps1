# Apaga las apps dockerizadas (deja la base prendida para desarrollo).
$raiz = Split-Path -Parent $PSScriptRoot
Push-Location $raiz
docker compose --profile apps --env-file .env.docker stop migrate api web tienda
Pop-Location
Push-Location (Join-Path $env:USERPROFILE 'acacia-store')
docker compose --env-file .env.local stop
Pop-Location
Write-Host 'Apps en Docker apagadas. La base sigue prendida.' -ForegroundColor Green
