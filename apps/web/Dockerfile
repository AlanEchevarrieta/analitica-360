# Web de Analítica 360 (Next.js, salida standalone). Se construye desde la raíz del repo:
#   docker build -f apps/web/Dockerfile -t analitica360-web \
#     --build-arg NEXT_PUBLIC_API_URL=https://api.analitica360.app \
#     --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_... .
# Las variables NEXT_PUBLIC_* quedan fijadas en la compilación (Next las incrusta
# en el JavaScript del navegador); las secretas se pasan al correr el contenedor.

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json apps/web/
COPY packages/shared-types/package.json packages/shared-types/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter web...

FROM deps AS build
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
ARG NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
ARG NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/inicio
ARG NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/inicio
ARG NEXT_PUBLIC_WHATSAPP_CONTACT
ARG NEXT_PUBLIC_TIENDA_LOCAL_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
    NEXT_PUBLIC_CLERK_SIGN_IN_URL=$NEXT_PUBLIC_CLERK_SIGN_IN_URL \
    NEXT_PUBLIC_CLERK_SIGN_UP_URL=$NEXT_PUBLIC_CLERK_SIGN_UP_URL \
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=$NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL \
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=$NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL \
    NEXT_PUBLIC_WHATSAPP_CONTACT=$NEXT_PUBLIC_WHATSAPP_CONTACT \
    NEXT_PUBLIC_TIENDA_LOCAL_URL=$NEXT_PUBLIC_TIENDA_LOCAL_URL \
    NEXT_OUTPUT=standalone
COPY apps/web apps/web
COPY packages packages
RUN pnpm --filter web build

FROM node:24-bookworm-slim AS runtime
# Sin npm, npx, yarn ni corepack: la app arranca con node y así no arrastran vulnerabilidades (Trivy).
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
# El standalone replica la estructura del monorepo: el servidor queda en apps/web/server.js.
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/sign-in').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
