#!/usr/bin/env bash
# Vista previa: la web nueva en el puerto 4101, hablando con la API de vista previa (3101).
# Mismo login de Clerk que la app de siempre; los datos son una copia (ver vista-previa-api.sh).
set -euo pipefail
cd "$(dirname "$0")/../apps/web"
export NEXT_PUBLIC_API_URL=http://localhost:3101
exec pnpm exec next dev -p 4101
