# Levanta TODO dockerizado en esta computadora (misma base y mismas fotos que en desarrollo):
#   - Postgres                     localhost:5433
#   - API (NestJS)                 http://localhost:3001
#   - Web (gestion)                http://localhost:3000
#   - Tienda modelo                http://acacia.localhost:3010
#   - Tienda de Acacia             http://localhost:3002   (repo ~/acacia-store)
# Uso: .\scripts\levantar-docker.ps1 [-Compilar] [-SinAbrir]   (-Compilar recompila las imagenes con el codigo actual;
#      -SinAbrir no abre el navegador, ej. desde la auditoria semanal)
# Los contenedores quedan con restart unless-stopped: vuelven solos al prender Docker.
# Para apagarlos: .\scripts\apagar-docker.ps1

param([switch]$Compilar, [switch]$SinAbrir)

# Continue (no Stop): docker escribe su progreso por stderr y PowerShell 5.1 lo
# toma como error. Los fallos reales se detectan con $LASTEXITCODE.
$ErrorActionPreference = 'Continue'
$raiz = Split-Path -Parent $PSScriptRoot
$acacia = Join-Path $env:USERPROFILE 'acacia-store'

function DockerListo { cmd /c "docker info >nul 2>&1"; return ($LASTEXITCODE -eq 0) }

function Esperar($descripcion, [scriptblock]$listo, $segundos = 240) {
  Write-Host "Esperando $descripcion..." -NoNewline
  $limite = (Get-Date).AddSeconds($segundos)
  while (-not (& $listo)) {
    if ((Get-Date) -gt $limite) { Write-Host ' no respondio.' -ForegroundColor Red; return $false }
    Start-Sleep -Seconds 3; Write-Host '.' -NoNewline
  }
  Write-Host ' listo.' -ForegroundColor Green
  return $true
}

function Responde($url) {
  try { $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5 -MaximumRedirection 0 -ErrorAction Stop; return $true }
  catch { return [bool]$_.Exception.Response }
}

# Los servidores de desarrollo (pnpm dev) usan los mismos puertos: avisar si estan prendidos.
$ocupados = foreach ($p in 3000, 3001, 3002, 3010) {
  $c = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($c -and (Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue).ProcessName -eq 'node') { $p }
}
if ($ocupados) {
  Write-Host "Hay servidores de desarrollo usando los puertos $($ocupados -join ', '). Cerra esas ventanas y volve a correr esto." -ForegroundColor Yellow
  exit 1
}

if (-not (DockerListo)) {
  Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
  if (-not (Esperar 'Docker' { DockerListo })) { exit 1 }
}

# Siempre un array: un `if` que devuelve un solo elemento queda como string y,
# al expandirlo con @, Docker recibía "-" (no such service: -).
$build = @()
if ($Compilar) { $build = @('--build') }

Push-Location $raiz
try {
  if (-not (Test-Path '.env.docker')) { throw "Falta .env.docker en $raiz (copiar .env.docker.example y completar)" }
  docker compose --profile apps --env-file .env.docker up -d $build
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo levantar Analitica 360' }
} finally { Pop-Location }

Push-Location $acacia
try {
  docker compose --env-file .env.local up -d $build
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo levantar la tienda de Acacia' }
} finally { Pop-Location }

if ((Esperar 'la web' { Responde 'http://localhost:3000/sign-in' }) -and -not $SinAbrir) {
  Start-Process 'http://localhost:3002'
  Start-Process 'http://localhost:3000'
}
Write-Host "`nTodo levantado en Docker. Estado: docker ps" -ForegroundColor Green
