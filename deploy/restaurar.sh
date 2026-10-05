#!/usr/bin/env bash
# Restaura una copia de seguridad en la base de producción.
#   docker compose -f docker-compose.prod.yml --env-file .env.produccion run --rm backup \
#     bash /deploy/restaurar.sh analitica360-20261005-0600.dump
#
# Antes de restaurar se hace una copia de lo que hay ahora (por si hay que volver atrás).
# Después: reiniciar la API (docker compose ... restart api) para que no queden datos en caché.
set -euo pipefail

archivo="${1:?Indicá el archivo (ej. analitica360-20261005-0600.dump); las copias están en /backups}"
[ -f "$archivo" ] || archivo="/backups/$archivo"
[ -f "$archivo" ] || { echo "No existe $archivo"; exit 1; }
pg_restore --list "$archivo" > /dev/null

# Se trabaja sobre una copia aparte del archivo elegido: pase lo que pase, el original no se toca.
elegido="$(mktemp /tmp/restaurar-XXXXXX.dump)"
cp "$archivo" "$elegido"
trap 'rm -f "$elegido"' EXIT

echo "Copia de lo que hay ahora, antes de restaurar (antes-de-restaurar-*.dump)..."
BACKUP_UNA_VEZ=1 BACKUP_PREFIJO=antes-de-restaurar bash /deploy/backup.sh

echo "Restaurando $archivo en $PGDATABASE (borra y vuelve a crear las tablas)..."
pg_restore --clean --if-exists --no-owner --single-transaction --dbname="$PGDATABASE" "$elegido"
echo "Listo. Reiniciá la API: docker compose -f docker-compose.prod.yml --env-file .env.produccion restart api"
