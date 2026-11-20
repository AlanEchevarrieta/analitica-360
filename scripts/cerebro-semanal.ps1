# Agente de los lunes: Claude escribe solo el resumen semanal en Obsidian.
# Lo llama auditoria-semanal.ps1 al terminar la auditoria (salga verde o roja).
# Las instrucciones estan en scripts/cerebro-semanal.md. Registro: .auditorias/semanal.log
#
# Correrlo a mano:   .\scripts\cerebro-semanal.ps1

$ErrorActionPreference = 'Continue'
$raiz = Split-Path -Parent $PSScriptRoot
# Sin tildes en este archivo: PowerShell 5.1 lo lee en ANSI. La carpeta "Analitica 360" lleva tilde.
$vault = (Get-ChildItem (Join-Path $env:USERPROFILE 'Documents\Alan') -Directory | Where-Object Name -like 'Anal*tica 360' | Select-Object -First 1).FullName
$log = Join-Path $raiz '.auditorias\semanal.log'
function Anotar($texto) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm') $texto" | Out-File -FilePath $log -Append -Encoding utf8 }

$claude = Join-Path $env:USERPROFILE '.local\bin\claude.exe'
if (-not (Test-Path $claude)) { $claude = 'claude' }

Set-Location $raiz
$hoy = Get-Date -Format 'yyyy-MM-dd'
# El pedido va en ASCII; las instrucciones (con tildes) las lee Claude del archivo.
$pedido = "Hoy es $hoy. Lee scripts/cerebro-semanal.md y segui esas instrucciones al pie de la letra."

Anotar 'Empieza el agente de los lunes (resumen semanal en Obsidian).'
# Bajar lo de GitHub (sin tocar las ramas locales): el hermano de Alan sube a main desde su compu.
git fetch --all --quiet 2>&1 | Out-File -FilePath $log -Append -Encoding utf8
# Solo puede leer y escribir archivos y mirar git; nada de push, Docker ni borrar.
$herramientas = 'Read,Write,Edit,Glob,Grep,Bash(git log:*),Bash(git status:*),Bash(git branch:*),Bash(ls:*)'
$salida = & $claude -p $pedido --add-dir "$vault" --permission-mode acceptEdits --allowedTools $herramientas 2>&1
$codigo = $LASTEXITCODE
$salida | Out-File -FilePath $log -Append -Encoding utf8
Anotar "Termino el agente de los lunes (codigo $codigo)."
exit $codigo
