# Analítica 360

Monorepo de **Analítica 360**: plataforma de gestión comercial (stock, ventas, compras, pedidos, clientes, contabilidad y analytics) y tiendas online multi-negocio.

---

## 🏗️ Estructura del Proyecto

El repositorio está organizado como un monorepo administrado con **pnpm workspaces** y **Turborepo**:

```
.
├── apps/
│   ├── api/            # Backend NestJS + Prisma ORM + PostgreSQL (puerto 3001)
│   ├── web/            # Panel de control / Dashboard en Next.js (puerto 4001)
│   └── acacia_web/     # Storefront dedicado Acacia (Next.js, puerto 3020)
├── packages/
│   ├── sdk/            # SDK oficial y widget embebible (@analitica360/sdk)
│   └── shared-types/   # Contratos de tipos y validaciones compartidas (Zod)
├── deploy/             # Archivos de despliegue y scripts de backup (Caddyfile, etc.)
└── scripts/            # Scripts de auditoría, pruebas de carga y utilidades
```

---

## 🚀 Inicio Rápido (Desarrollo Local)

### Requisitos previos
- **Node.js**: >= 20 (recomendado v24)
- **pnpm**: v12 (`corepack enable pnpm`)
- **Docker**: para la base de datos PostgreSQL

### 1. Instalar dependencias
```bash
pnpm install
```

### 2. Levantar la base de datos local
```bash
docker compose up -d postgres
```

### 3. Ejecutar los proyectos en modo desarrollo
Con un solo comando levantás todas las aplicaciones concurrentemente:
```bash
pnpm dev
```
O de forma individual por aplicación:
- **API**: `pnpm --filter api dev` (http://localhost:3001)
- **Web**: `pnpm --filter web dev` (http://localhost:4001)

---

## 🛠️ Comandos Globales

Desde la raíz del monorepo podés ejecutar:

| Comando | Descripción |
|---|---|
| `pnpm build` | Compila todas las aplicaciones y paquetes (`api`, `web`, `acacia_web`, `sdk`, `shared-types`) |
| `pnpm dev` | Inicia los entornos de desarrollo concurrentes con Turborepo |
| `pnpm lint` | Corre el linter en los módulos configurados (`oxlint` en API, `eslint` en Web) |
| `pnpm typecheck` | Valida tipos estáticos de TypeScript en todo el monorepo |
| `pnpm test` | Ejecuta las pruebas unitarias (Vitest en API, Node test en SDK) |
| `pnpm auditar` | Corre la suite completa de auditorías de seguridad, DAST y carga |

---

## 🐳 Ejecución con Docker

Para levantar la suite completa en contenedores Docker:
```bash
# Copiar plantilla de entorno
cp .env.docker.example .env.docker

# Levantar todos los servicios (Postgres, API, Migraciones, Web)
docker compose --profile apps --env-file .env.docker up -d --build
```
