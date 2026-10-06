#!/bin/sh
# Copia fuera del servidor (la corre el servicio "backup-nube" de docker-compose.prod.yml, imagen rclone).
#   - Una vez por día, una hora después de la copia de la base (BACKUP_HORA + 1, UTC).
#   - Sube /backups (las copias de la base) y /archivos (las fotos) al bucket R2_BUCKET de Cloudflare R2.
#   - Solo agrega: borrar algo en el servidor no lo borra en la nube. En la nube se borran las
#     copias de la base con más de BACKUP_NUBE_DIAS días (por defecto 30); las fotos se guardan siempre.
#   - BACKUP_UNA_VEZ=1: sube una vez y termina (para probar).
# Sin R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY queda esperando (no corta el resto).
set -eu

if [ -z "${R2_ACCOUNT_ID:-}" ] || [ -z "${R2_ACCESS_KEY_ID:-}" ] || [ -z "${R2_SECRET_ACCESS_KEY:-}" ]; then
  echo "Faltan las claves de Cloudflare R2 en .env.produccion: la copia fuera del servidor está apagada."
  exec sleep infinity
fi

# Remoto "r2" configurado por variables (sin archivo de configuración). Si ya viene definido
# (por ejemplo en una prueba local), se respeta.
export RCLONE_CONFIG_R2_TYPE="${RCLONE_CONFIG_R2_TYPE:-s3}"
export RCLONE_CONFIG_R2_PROVIDER="${RCLONE_CONFIG_R2_PROVIDER:-Cloudflare}"
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export RCLONE_CONFIG_R2_ENDPOINT="${RCLONE_CONFIG_R2_ENDPOINT:-https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com}"
export RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true

BUCKET="${R2_BUCKET:-analitica360-backups}"
DIAS="${BACKUP_NUBE_DIAS:-30}"
BASE=$(echo "${BACKUP_HORA:-06}" | sed 's/^0//')
HORA=$(( (${BASE:-0} + 1) % 24 ))

subir() {
  echo "$(date -u '+%F %T') subiendo copias y fotos a r2:$BUCKET"
  # Solo copias terminadas (las que están escribiéndose terminan en .tmp).
  rclone copy /backups "r2:$BUCKET/base" --include '*.dump' --immutable
  rclone copy /archivos "r2:$BUCKET/archivos"
  rclone delete "r2:$BUCKET/base" --min-age "${DIAS}d"
  echo "$(date -u '+%F %T') listo: $(rclone lsf "r2:$BUCKET/base" | wc -l) copias de la base en la nube"
}

if [ "${BACKUP_UNA_VEZ:-0}" = "1" ]; then
  subir
  exit 0
fi

echo "Copia fuera del servidor todos los días a las ${HORA}:00 UTC (bucket $BUCKET, base: ${DIAS} días)."
ultimo=""
while true; do
  hoy=$(date -u +%F)
  if [ "$(date -u +%H | sed 's/^0//')" = "$HORA" ] && [ "$ultimo" != "$hoy" ]; then
    subir || echo "$(date -u '+%F %T') ERROR: la subida a la nube falló" >&2
    ultimo="$hoy"
  fi
  sleep 600
done
