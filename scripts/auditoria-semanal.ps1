# Auditoria semanal automatica (la corre el Programador de tareas de Windows, los lunes).
# Levanta Docker si hace falta, corre `pnpm auditar` y deja el informe en Obsidian como siempre
# (Auditorias/Auditoria <fecha>.md) y el sello de la bitacora en Auditorias/Sellos de la bitacora.md.
# Registro de cada corrida: .auditorias/semanal.log
#
# Instalar la tarea:   .\scripts\auditoria-semanal.ps1 -Instalar
# Sacarla:             .\scripts\auditoria-semanal.ps1 -Desinstalar
# Correrla ya:         .\scripts\auditoria-semanal.ps1

param([switch]$Instalar, [switch]$Desinstalar)

$ErrorActionPreference = 'Continue'
$raiz = Split-Path -Parent $PSScriptRoot
$nombreTarea = 'Analitica 360 - Auditoria semanal'

if ($Instalar) {
  $accion = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$PSCommandPath`"" -WorkingDirectory $raiz
  $cuando = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At 10am
  # StartWhenAvailable: si la compu estaba apagada el lunes, corre apenas se prende.
  $opciones = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
  Register-ScheduledTask -TaskName $nombreTarea -Action $accion -Trigger $cuando -Settings $opciones -Description 'Corre pnpm auditar y guarda el informe en Obsidian.' -Force | Out-Null
  Write-Host "Listo: '$nombreTarea' corre los lunes a las 10 (o al prender la compu, si estaba apagada)." -ForegroundColor Green
  return
}
if ($Desinstalar) {
  Unregister-ScheduledTask -TaskName $nombreTarea -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Se saco la tarea '$nombreTarea'."
  return
}

$carpeta = Join-Path $raiz '.auditorias'
New-Item -ItemType Directory -Force $carpeta | Out-Null
$log = Join-Path $carpeta 'semanal.log'
function Anotar($texto) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm') $texto" | Out-File -FilePath $log -Append -Encoding utf8 }

Anotar 'Empieza la auditoria semanal.'
Set-Location $raiz
# Todo en UTF-8 (con *>> PowerShell 5.1 escribiria en UTF-16 y el registro quedaria mezclado).
try {
  & (Join-Path $PSScriptRoot 'levantar-docker.ps1') -SinAbrir *>&1 | Out-File -FilePath $log -Append -Encoding utf8
} catch {
  Anotar "No se pudo levantar Docker: $($_.Exception.Message). No se audito."
  exit 1
}

cmd /c "pnpm auditar >> `"$log`" 2>&1"
$codigo = $LASTEXITCODE
Anotar "Termino la auditoria (codigo $codigo). El informe esta en Obsidian: Auditorias."
exit $codigo
