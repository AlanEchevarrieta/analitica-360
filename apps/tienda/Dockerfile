# Tienda modelo multi-negocio (Next.js, salida standalone). Se construye desde la raíz del repo:
#   docker build -f apps/tienda/Dockerfile -t analitica360-tienda .
# Todo se configura al correr: ANALITICA_API_URL (API vista desde el servidor),
# ANALITICA_TIENDA_KEY y, para probar sin subdominio, TIENDA_HOST_FORZADO.

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/tienda/package.json apps/tienda/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter tienda...

FROM deps AS build
ENV NEXT_OUTPUT=standalone
COPY apps/tienda apps/tienda
RUN pnpm --filter tienda build

FROM node:24-bookworm-slim AS runtime
# Sin npm, npx, yarn ni corepack: la app arranca con node y así no arrastran vulnerabilidades (Trivy).
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3010 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/tienda/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/tienda/.next/static ./apps/tienda/.next/static
COPY --from=build --chown=node:node /repo/apps/tienda/public ./apps/tienda/public
USER node
EXPOSE 3010
CMD ["node", "apps/tienda/server.js"]
