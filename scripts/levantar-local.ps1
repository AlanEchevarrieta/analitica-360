# Levanta todo el entorno local de Analítica 360 + Acacia Store.
#   - Postgres (Docker)            localhost:5433
#   - API NestJS (apps/api)        http://localhost:3001
#   - Web nueva (apps/web)         http://localhost:3000
#   - Tienda (acacia-store)        http://localhost:3002
# Cada servicio abre su propia ventana; cerrarla detiene ese servicio.

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$tienda = Join-Path $env:USERPROFILE 'acacia-store'

function Esperar($descripcion, [scriptblock]$listo, $segundos = 180) {
  Write-Host "Esperando $descripcion..." -NoNewline
  $limite = (Get-Date).AddSeconds($segundos)
  while (-not (& $listo)) {
    if ((Get-Date) -gt $limite) { Write-Host ' no respondió.' -ForegroundColor Red; return $false }
    Start-Sleep -Seconds 3; Write-Host '.' -NoNewline
  }
  Write-Host ' listo.' -ForegroundColor Green
  return $true
}

function PuertoAbierto($puerto) {
  [bool](Get-NetTCPConnection -LocalPort $puerto -State Listen -ErrorAction SilentlyContinue)
}

function Abrir($titulo, $carpeta, $comando, $puerto) {
  if (PuertoAbierto $puerto) { Write-Host "$titulo ya estaba corriendo (puerto $puerto)."; return }
  Start-Process powershell -ArgumentList '-NoExit', '-Command',
    "`$Host.UI.RawUI.WindowTitle = '$titulo'; Set-Location '$carpeta'; $comando"
}

# Por cmd: con ErrorActionPreference=Stop, el error de `docker info` (Docker
# apagado) cortaba el script en vez de prender Docker Desktop.
function DockerListo { cmd /c "docker info >nul 2>&1"; return ($LASTEXITCODE -eq 0) }

# 1. Docker + Postgres
if (-not (DockerListo)) {
  Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
  if (-not (Esperar 'Docker' { DockerListo } 240)) { exit 1 }
}
Push-Location $raiz
docker compose up -d
Pop-Location

# 2. Servicios (cada uno en su ventana)
Abrir 'API Analitica 360 (3001)' (Join-Path $raiz 'apps\api') 'pnpm start:dev' 3001
Abrir 'Web Analitica 360 (3000)' (Join-Path $raiz 'apps\web') 'pnpm dev' 3000
Abrir 'Acacia Store (3002)' $tienda 'npx next dev -p 3002' 3002

# 3. Abrir en el navegador cuando respondan
if (Esperar 'la API' { PuertoAbierto 3001 } 900) { }
if (Esperar 'la tienda' { PuertoAbierto 3002 } 900) { Start-Process 'http://localhost:3002' }
if (Esperar 'la web' { PuertoAbierto 3000 } 900) { Start-Process 'http://localhost:3000' }

Write-Host "`nTodo levantado. Para apagar: cerrá las ventanas de cada servicio." -ForegroundColor Green
