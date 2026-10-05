# API de Analítica 360 (NestJS + Prisma). Se construye desde la raíz del repo:
#   docker build -f apps/api/Dockerfile -t analitica360-api .
# Targets:
#   runtime (por defecto)  la API lista para producción
#   migrate                aplica las migraciones pendientes (prisma migrate deploy) y termina

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo

# 1. Dependencias: solo los manifiestos, para aprovechar la caché de Docker.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/shared-types/package.json packages/shared-types/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter api...

# 2. Compilación: cliente de Prisma + nest build.
FROM deps AS build
COPY apps/api apps/api
COPY packages packages
WORKDIR /repo/apps/api
# prisma.config.ts pide DATABASE_URL, pero generar el cliente no se conecta a ninguna base.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm exec prisma generate && pnpm build

# 3. Migraciones: usa el CLI de Prisma (devDependency) contra DATABASE_URL.
FROM build AS migrate
# Sin root también para migrar (Semgrep: dockerfile.security.missing-user).
USER node
# Prisma directo (sin pnpm): pnpm exec revisa las dependencias del workspace al arrancar e intenta
# instalar lo que falta, y como usuario node no puede escribir en su almacén.
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

# 4. Paquete de producción: solo dependencias de runtime + el cliente de Prisma ya generado.
FROM build AS prod-deps
WORKDIR /repo
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm --filter api deploy --prod /out \
 && cp -r apps/api/dist /out/dist \
 && for d in /out/node_modules/.pnpm/@prisma+client@*/node_modules; do \
      src=$(ls -d /repo/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma | head -1); \
      cp -r "$src" "$d/.prisma"; \
    done

FROM node:24-bookworm-slim AS runtime
# Sin npm, npx, yarn ni corepack: la app arranca con node y así no arrastran vulnerabilidades (Trivy).
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg
ENV NODE_ENV=production PORT=3001 ARCHIVOS_DIR=/data/archivos
WORKDIR /app
COPY --from=prod-deps --chown=node:node /out ./
RUN mkdir -p /data/archivos && chown -R node:node /data
USER node
EXPOSE 3001
VOLUME ["/data/archivos"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
