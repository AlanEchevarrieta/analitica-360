#!/usr/bin/env bash
# Vista previa: la API nueva en el puerto 3101 contra una COPIA de la base (base "vista" en pg-e2e, 5499).
# No toca la base real ni los contenedores de la app. Las integraciones van con datos de mentira:
# se ven las pantallas, pero no se puede facturar, conectar Zipnova ni cobrar de verdad.
set -euo pipefail
cd "$(dirname "$0")/../apps/api"
export DATABASE_URL=postgresql://postgres:e2e@localhost:5499/vista
export PORT=3101
export CORS_ORIGINS=http://localhost:4101
export API_URL_PUBLICA=http://localhost:3101
export APP_URL_PUBLICA=http://localhost:4101
export CLAVE_CIFRADO="${CLAVE_CIFRADO:-$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")}"
# Datos de mentira solo para que las pantallas aparezcan (no sirven para operar).
export ARCA_CUIT=20111111112
export ARCA_CERTIFICADO=VISTA-PREVIA-SIN-CERTIFICADO-REAL-VISTA-PREVIA-SIN-CERTIFICADO
export ARCA_CLAVE=VISTA-PREVIA-SIN-CLAVE-REAL-VISTA-PREVIA-SIN-CLAVE-REAL-0000000
export MP_ACCESS_TOKEN=VISTA-PREVIA-SIN-TOKEN
export MP_WEBHOOK_SECRET=VISTA-PREVIA
export MP_CLIENT_ID=VISTA-PREVIA
export MP_CLIENT_SECRET=VISTA-PREVIA-SIN-SECRETO
exec node dist/main
