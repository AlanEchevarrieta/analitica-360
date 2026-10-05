#!/usr/bin/env bash
# Copia de seguridad diaria de la base (la corre el servicio "backup" de docker-compose.prod.yml).
#   - Todos los días a la hora BACKUP_HORA (UTC, por defecto 06 = 3 de la mañana en Argentina).
#   - Formato custom de pg_dump (comprimido; se restaura con deploy/restaurar.sh).
#   - Guarda BACKUP_DIAS días (por defecto 14) en el volumen /backups.
#   - BACKUP_UNA_VEZ=1: hace una copia y termina (para probar o antes de un cambio grande).
# Variables de conexión: PGHOST, PGUSER, PGPASSWORD, PGDATABASE (las estándar de Postgres).
#
# IMPORTANTE: el volumen /backups vive en el mismo servidor. Para tener la copia "fuera del
# servidor" (si se rompe el disco), activar los snapshots del proveedor o sincronizar /backups
# a otro lugar (ej. rclone a un bucket). Ver Obsidian: Deploy y CI-CD.
set -euo pipefail

HORA="${BACKUP_HORA:-06}"
DIAS="${BACKUP_DIAS:-14}"
DESTINO=/backups

copia() {
  # Con segundos y con un prefijo opcional (ej. "antes-de-restaurar"): una copia nunca pisa a otra.
  local archivo="$DESTINO/${BACKUP_PREFIJO:-analitica360}-$(date -u +%Y%m%d-%H%M%S).dump"
  if [ -e "$archivo" ]; then echo "Ya existe $archivo: no se pisa" >&2; return 1; fi
  echo "$(date -u '+%F %T') copiando la base a $archivo"
  pg_dump --format=custom --no-owner --file="$archivo.tmp"
  # Se comprueba que el archivo se pueda leer antes de darlo por bueno.
  pg_restore --list "$archivo.tmp" > /dev/null
  mv "$archivo.tmp" "$archivo"
  echo "$(date -u '+%F %T') listo: $(du -h "$archivo" | cut -f1)"
  find "$DESTINO" -name 'analitica360-*.dump' -mtime "+$DIAS" -print -delete
}

mkdir -p "$DESTINO"
until pg_isready -q; do sleep 2; done

if [ "${BACKUP_UNA_VEZ:-0}" = "1" ]; then
  copia
  exit 0
fi

echo "Copias diarias a las ${HORA}:00 UTC, se guardan ${DIAS} días."
while true; do
  # Segundos hasta la próxima HORA:00 UTC.
  ahora=$(date -u +%s)
  proxima=$(date -u -d "today ${HORA}:00" +%s)
  [ "$proxima" -le "$ahora" ] && proxima=$(date -u -d "tomorrow ${HORA}:00" +%s)
  sleep $((proxima - ahora))
  copia || echo "$(date -u '+%F %T') ERROR: la copia falló" >&2
done
