# Carga la API key de Resend (emails) sin que pase por ningún chat ni quede en la pantalla.
#   - La guarda en .env.docker (modo Docker) y en apps/api/.env (modo desarrollo); los dos están en .gitignore.
#   - Comprueba con Resend que la clave ande.
#   - Reinicia la API de Docker para que la tome.
# Uso: doble clic en "Cargar clave de Resend" (Escritorio).

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot

Write-Host ''
Write-Host 'Clave de Resend para los emails de Analítica 360' -ForegroundColor Cyan
Write-Host 'La sacás de resend.com → API Keys → Create API Key (permiso "Full access" o "Sending access").'
Write-Host 'Pegala acá con clic derecho y Enter. No se muestra en pantalla.'
Write-Host ''
$segura = Read-Host 'API key' -AsSecureString
$clave = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura)).Trim()
if ($clave -notmatch '^re_[A-Za-z0-9_]{10,}$') {
  Write-Host 'Eso no parece una clave de Resend (empieza con re_). No se guardó nada.' -ForegroundColor Red
  exit 1
}

# 1. Que la clave ande: Resend responde 200 (clave completa) o 401 "restricted_api_key" (solo envío): las dos sirven.
try {
  Invoke-RestMethod -Uri 'https://api.resend.com/domains' -Headers @{ Authorization = "Bearer $clave" } -TimeoutSec 20 | Out-Null
  Write-Host 'Resend aceptó la clave.' -ForegroundColor Green
} catch {
  $detalle = "$($_.ErrorDetails.Message)"
  if ($detalle -match 'restricted_api_key') {
    Write-Host 'Resend aceptó la clave (solo envío).' -ForegroundColor Green
  } else {
    Write-Host "Resend rechazó la clave: $detalle" -ForegroundColor Red
    Write-Host 'No se guardó nada. Revisá que la hayas copiado entera.'
    exit 1
  }
}

# 2. Guardarla en los dos archivos de configuración (reemplaza la que hubiera).
function Guardar([string]$archivo) {
  $lineas = @()
  if (Test-Path $archivo) { $lineas = @(Get-Content -LiteralPath $archivo -Encoding UTF8 | Where-Object { $_ -notmatch '^\s*RESEND_API_KEY\s*=' }) }
  $lineas += "RESEND_API_KEY=$clave"
  [IO.File]::WriteAllLines($archivo, [string[]]$lineas, (New-Object Text.UTF8Encoding $false))
  Write-Host "Guardada en $archivo"
}
Guardar (Join-Path $raiz '.env.docker')
Guardar (Join-Path $raiz 'apps\api\.env')
$clave = $null

# 3. Reiniciar la API de Docker (si está corriendo) para que la tome.
Push-Location $raiz
try {
  $corriendo = docker ps --format '{{.Names}}' 2>$null | Select-String -SimpleMatch 'analitica-360-api-1'
  if ($corriendo) {
    docker compose --profile apps --env-file .env.docker up -d --no-deps api | Out-Null
    Write-Host 'API reiniciada con la clave nueva.' -ForegroundColor Green
  } else {
    Write-Host 'La API de Docker no está prendida: la toma la próxima vez que levantes el sistema.'
  }
} finally { Pop-Location }

Write-Host ''
Write-Host 'Listo. Para probar: Analítica 360 → Configuración → Informes por email → "Enviarme uno de prueba".' -ForegroundColor Cyan
Write-Host 'Mientras el dominio no esté verificado en Resend, los emails solo llegan al email con el que creaste la cuenta de Resend.'
