---
tags: [analitica360, para-implementar, servicios, agente]
estado: para hacer
creado: 2026-11-03
base: main 9384b29 (2026-11-01)
---
# Proyectos · Fase 1: etapas, responsables, aprobaciones y atrasos
Volver a [[Para implementar]] · Contexto: [[Módulo de proyectos (propuesta)]]

> **Para el hermano de Alan y sus agentes de IA.** Pasale este documento entero al agente como instrucción. Está escrito para que lo pueda seguir paso a paso sin adivinar. Lo armó Claude leyendo `main` (`9384b29`); Claude no tocó código.

---

## 0. Instrucciones para el agente (leer primero)
**Objetivo:** agregar el módulo **Proyectos** a Analítica 360. Un negocio de servicios (agencia de marketing, estudio, consultora) tiene que poder:
- crear proyectos con etapas sacadas de **plantillas que el dueño edita**;
- asignar un responsable a cada etapa;
- registrar **quién aprobó cada etapa, cuándo y qué versión** (aprobación interna y del cliente);
- ver en un tablero qué está atrasado y cuánto se espera al cliente.

**Esta fase no incluye plata:** nada de horas, costos ni rentabilidad (eso es la Fase 2, al final del documento).

**Reglas que no se negocian:**
1. **Trabajar en una rama** `feat/proyectos-fase-1` y abrir un Pull Request. No subir directo a `main`.
2. **Copiar la estructura y el estilo del módulo `ordenes-trabajo`,** que es el más parecido:
   - API: `apps/api/src/modules/ordenes-trabajo/` (controller, module, service y `*.util.ts` con su `*.util.spec.ts`);
   - web: `apps/web/src/features/ordenes-trabajo/` y `apps/web/src/app/(dashboard)/ordenes-trabajo/`.
3. **Cada consulta filtra por `empresaId`.** Nunca devolver datos de otra empresa: buscar siempre con `findFirst({ where: { id, empresaId } })`.
4. **Validación con Zod** en el controlador (`ZodValidationPipe`), como en `ordenes-trabajo.controller.ts`. Rutas `:id` con `ParseUUIDPipe`.
5. **La lógica pura** (cambios de estado, fechas, métricas) va en `proyectos.util.ts`, con pruebas en `proyectos.util.spec.ts`. El service solo lee y escribe.
6. **Textos de pantalla en español rioplatense y simple**, como el resto de la app ("Elegí", "Contá", "Listo").
7. **Web:**
   - componentes de menos de 250 líneas;
   - React Query en un hook `use-proyectos.ts`;
   - los **4 estados** en cada pantalla: cargando, vacío, error y ok, con `CargandoFilas`, `SinDatos` y `ErrorDatos` de `@/components/shared/estado-datos`;
   - que funcione en el celular (390 px).
8. **No tocar** ventas, stock, caja ni cobros en esta fase.
9. **Terminado** = la sección 9 entera tildada y las pruebas en verde.

---

## 1. Cómo lo va a usar el negocio (la historia)
1. **Configuración → Proyectos:** el dueño revisa las plantillas que vienen de ejemplo (Campaña, Redes mensual, Branding y Genérico). Les cambia el nombre, agrega o saca etapas, cambia el orden, los días objetivo y quién aprueba.
2. **Ventas → Proyectos → Nuevo:**
   - elige el cliente, el nombre ("Campaña Día de la Madre – Óptica Sur"), la plantilla, el responsable de la cuenta, el equipo, la fecha de inicio y la fecha comprometida;
   - las etapas se copian de la plantilla con fechas objetivo calculadas;
   - se puede ajustar el responsable y la fecha de cada etapa.
3. **El responsable de la etapa** toca **Empezar**. Al terminar, toca **Enviar a revisión**, y la versión queda en v1.
4. **Aprobación interna:** el aprobador interno (por ejemplo, el director creativo) toca **Aprobar** o **Pedir cambios**, con un comentario. Si pide cambios, la etapa vuelve a "en curso" y la versión pasa a v2.
5. **Aprobación del cliente:** quien habla con el cliente toca **Registrar respuesta del cliente** y carga:
   - quién aprobó (nombre);
   - por dónde (WhatsApp, email, reunión o en persona);
   - qué versión, y si aprobó o pidió cambios;
   - un comentario y, opcional, un link de prueba (captura en Drive, mail).
   El botón **"Pedir aprobación por WhatsApp"** arma el mensaje.
6. **Aprobada la etapa, se habilita la siguiente.** Cuando están todas aprobadas u omitidas, el proyecto se puede **Terminar**.
7. **La dueña** mira **Proyectos**:
   - un tablero con columnas por etapa actual;
   - tarjetas rojas si está atrasado;
   - una etiqueta "Esperando al cliente · 3 días";
   - en cada proyecto, la línea de tiempo con quién aprobó qué y cuándo;
   - la pestaña **Tiempos**, con cuánto se trabaja y cuánto se espera en cada etapa.

---

## 2. Base de datos (Prisma)
**Archivo:** `apps/api/prisma/schema.prisma`. Seguir la convención del repo: modelos en PascalCase, tablas y columnas en `snake_case` con `@@map` y `@map`, `id` UUID con `gen_random_uuid()` y `createdAt` y `updatedAt`.

**Migración:** `apps/api/prisma/migrations/2026MMDDHHMMSS_proyectos/migration.sql`, generada con `pnpm --filter api exec prisma migrate dev --name proyectos`.

```prisma
model PlantillaProyecto {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  empresaId   String   @map("empresa_id") @db.Uuid
  nombre      String   @db.VarChar(120)
  descripcion String?  @db.VarChar(500)
  activa      Boolean  @default(true)
  orden       Int      @default(0)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  etapas      PlantillaEtapa[]
  @@index([empresaId])
  @@map("plantillas_proyecto")
}

model PlantillaEtapa {
  id                  String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  plantillaId         String  @map("plantilla_id") @db.Uuid
  orden               Int
  nombre              String  @db.VarChar(120)
  /// Días corridos que debería durar (para calcular la fecha objetivo). null = sin plazo.
  diasObjetivo        Int?    @map("dias_objetivo")
  /// ninguna | interna | cliente | ambas (primero interna y después cliente)
  aprobacion          String  @default("ninguna") @db.VarChar(10)
  /// Quién aprueba adentro por defecto (si es null, cualquier usuario con permiso o el dueño).
  aprobadorInternoId  String? @map("aprobador_interno_id") @db.Uuid
  plantilla           PlantillaProyecto @relation(fields: [plantillaId], references: [id], onDelete: Cascade)
  @@index([plantillaId])
  @@map("plantillas_etapa")
}

model Proyecto {
  id                String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  empresaId         String    @map("empresa_id") @db.Uuid
  numero            Int
  nombre            String    @db.VarChar(200)
  clienteId         String?   @map("cliente_id") @db.Uuid
  clienteNombre     String?   @map("cliente_nombre")
  descripcion       String?   @db.VarChar(4000)
  /// activo | pausado | terminado | cancelado
  estado            String    @default("activo") @db.VarChar(12)
  responsableId     String?   @map("responsable_id") @db.Uuid
  plantillaId       String?   @map("plantilla_id") @db.Uuid
  plantillaNombre   String?   @map("plantilla_nombre") @db.VarChar(120)
  fechaInicio       DateTime  @map("fecha_inicio") @db.Date
  fechaComprometida DateTime? @map("fecha_comprometida") @db.Date
  /// Solo informativo en la Fase 1 (no genera ventas ni cobros).
  montoAcordado     Decimal?  @map("monto_acordado") @db.Decimal(14, 2)
  presupuestoId     String?   @unique @map("presupuesto_id") @db.Uuid
  terminadoEn       DateTime? @map("terminado_en")
  motivoCancelacion String?   @map("motivo_cancelacion") @db.VarChar(300)
  usuarioId         String    @map("usuario_id") @db.Uuid
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")
  etapas            ProyectoEtapa[]
  miembros          ProyectoMiembro[]
  eventos           ProyectoEvento[]
  @@unique([empresaId, numero])
  @@index([empresaId, estado])
  @@map("proyectos")
}

model ProyectoMiembro {
  proyectoId String @map("proyecto_id") @db.Uuid
  usuarioId  String @map("usuario_id") @db.Uuid
  proyecto   Proyecto @relation(fields: [proyectoId], references: [id], onDelete: Cascade)
  @@id([proyectoId, usuarioId])
  @@map("proyectos_miembros")
}

model ProyectoEtapa {
  id                 String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  proyectoId         String    @map("proyecto_id") @db.Uuid
  orden              Int
  nombre             String    @db.VarChar(120)
  /// pendiente | en_curso | en_revision | aprobada | omitida
  estado             String    @default("pendiente") @db.VarChar(12)
  aprobacion         String    @default("ninguna") @db.VarChar(10)
  /// Dentro de en_revision con aprobacion = ambas: interna | cliente (qué aprobación falta).
  falta              String?   @db.VarChar(8)
  responsableId      String?   @map("responsable_id") @db.Uuid
  aprobadorInternoId String?   @map("aprobador_interno_id") @db.Uuid
  fechaObjetivo      DateTime? @map("fecha_objetivo") @db.Date
  version            Int       @default(1)
  iniciadaEn         DateTime? @map("iniciada_en")
  enRevisionDesde    DateTime? @map("en_revision_desde")
  cerradaEn          DateTime? @map("cerrada_en")
  /// Acumulados para las métricas (en minutos), se suman en cada cambio de estado.
  minutosTrabajo     Int       @default(0) @map("minutos_trabajo")
  minutosEspera      Int       @default(0) @map("minutos_espera")
  rondasCambios      Int       @default(0) @map("rondas_cambios")
  proyecto           Proyecto  @relation(fields: [proyectoId], references: [id], onDelete: Cascade)
  aprobaciones       ProyectoAprobacion[]
  @@index([proyectoId])
  @@map("proyectos_etapas")
}

model ProyectoAprobacion {
  id                 String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  etapaId            String   @map("etapa_id") @db.Uuid
  /// interna | cliente
  tipo               String   @db.VarChar(8)
  /// aprobada | cambios
  resultado          String   @db.VarChar(8)
  version            Int
  /// Interna: el usuario que aprobó. Cliente: null (se guarda el nombre).
  aprobadorUsuarioId String?  @map("aprobador_usuario_id") @db.Uuid
  aprobadorNombre    String   @map("aprobador_nombre") @db.VarChar(160)
  /// en_sistema | whatsapp | email | reunion | en_persona | link (Fase 3)
  medio              String   @db.VarChar(12)
  comentario         String?  @db.VarChar(2000)
  evidenciaUrl       String?  @map("evidencia_url") @db.VarChar(500)
  /// Fecha y hora en que el cliente aprobó (puede ser anterior a la carga).
  aprobadoEn         DateTime @map("aprobado_en")
  registradoPorId    String   @map("registrado_por_id") @db.Uuid
  createdAt          DateTime @default(now()) @map("created_at")
  etapa              ProyectoEtapa @relation(fields: [etapaId], references: [id], onDelete: Cascade)
  @@index([etapaId])
  @@map("proyectos_aprobaciones")
}

/// Historial inalterable del proyecto (solo se agregan filas, nunca se editan ni se borran).
model ProyectoEvento {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  proyectoId String   @map("proyecto_id") @db.Uuid
  etapaId    String?  @map("etapa_id") @db.Uuid
  /// creado | editado | etapa_iniciada | enviada_revision | aprobada | cambios | omitida | responsable | pausado | reanudado | terminado | cancelado
  tipo       String   @db.VarChar(20)
  detalle    Json?
  usuarioId  String?  @map("usuario_id") @db.Uuid
  createdAt  DateTime @default(now()) @map("created_at")
  proyecto   Proyecto @relation(fields: [proyectoId], references: [id], onDelete: Cascade)
  @@index([proyectoId, createdAt])
  @@map("proyectos_eventos")
}
```

**Además:**
- **Bitácora de auditoría:** sumar `PlantillaProyecto`, `Proyecto`, `ProyectoEtapa` y `ProyectoAprobacion` a `AUDITADOS` en `apps/api/src/common/auditoria/auditoria.util.ts`, con `campoNombre` `['nombre']`, `['nombre']`, `['nombre']` y `['aprobadorNombre']`.
- **Exportar mis datos y borrar la cuenta:** sumar las tablas nuevas donde se exportan y se borran los datos de una empresa. Buscar cómo lo hacen `ordenes_trabajo` y `turnos` en `import-export` y en `bajas`.

---

## 3. Reglas del negocio (`apps/api/src/modules/proyectos/proyectos.util.ts`)
Todo en funciones puras, con pruebas.

### 3.1 Estados de una etapa
```
pendiente ──Empezar──▶ en_curso ──Terminar (sin aprobación)──▶ aprobada
                         │
                         └─Enviar a revisión (con aprobación)──▶ en_revision
                                                                 │
                    ◀── Pedir cambios (versión + 1, rondas + 1) ─┤
                                                                 └─ Aprobar ─▶ aprobada
pendiente | en_curso ──Omitir (con motivo)──▶ omitida
```
- **Secuencial:** solo se puede **Empezar** la etapa de menor `orden` que no esté `aprobada` ni `omitida`. Es la **etapa actual**.
- **`aprobacion = 'ambas'`:**
  - al enviar a revisión, `falta = 'interna'`;
  - si la interna aprueba, `falta = 'cliente'`, sin cambiar la versión;
  - si el cliente aprueba, la etapa queda `aprobada`;
  - si cualquiera pide cambios, la etapa vuelve a `en_curso`, con `version + 1` y `rondasCambios + 1`.
- **`aprobacion = 'interna'` o `'cliente'`:** una sola aprobación.
- **No se puede aprobar una versión distinta de `etapa.version`.** Si llega otra, responder 409 con "Esa versión ya no es la actual".
- **Exportar:** `transicionEtapa(etapa, accion, datos) → { ok: true, cambios } | { ok: false, motivo }`. Las acciones son `empezar`, `enviar_revision`, `terminar`, `aprobar`, `pedir_cambios` y `omitir`.

### 3.2 Quién puede hacer qué
- **Empezar, enviar a revisión, terminar y omitir:** el responsable de la etapa, el responsable del proyecto o el dueño. Además tienen que tener el permiso `registrar_ventas`, como en órdenes de trabajo.
- **Aprobación interna:** el `aprobadorInternoId` de la etapa. Si es null, el responsable del proyecto. **Nunca la misma persona que envió a revisión**, salvo el dueño. Así hay control de verdad.
- **Registrar la respuesta del cliente:** cualquiera con `registrar_ventas`. Queda `registradoPorId` y el `medio`.
- **Editar plantillas:** solo el dueño (`rol === 'dueno'`).

### 3.3 Fechas objetivo
- Al crear desde la plantilla: `fechaObjetivo(etapa n) = fechaInicio + suma de diasObjetivo de las etapas 1..n`, en días corridos. Si una etapa tiene `diasObjetivo = null`, no suma y queda sin fecha.
- Si la última fecha objetivo cae después de `fechaComprometida`, la web avisa: "Con estos plazos terminás el 28/11, después de lo comprometido (20/11)". No bloquea.
- **Exportar:** `fechasObjetivo(fechaInicio, etapas[])`.

### 3.4 Atrasos y espera
- **Etapa atrasada:** `fechaObjetivo < hoy` y estado distinto de `aprobada` y de `omitida`.
- **Proyecto atrasado:**
  - si está activo: `fechaComprometida < hoy`;
  - si está terminado: `terminadoEn > fechaComprometida`.
  - `diasAtraso` es la diferencia en días.
- **Esperando al cliente:** etapa `en_revision` con `falta = 'cliente'`, o `aprobacion = 'cliente'`. Los días van desde `enRevisionDesde`.
- **Tiempos acumulados**, que se actualizan en cada transición:
  - `minutosTrabajo` suma el tiempo en `en_curso` (de `iniciadaEn`, o de la última vuelta a `en_curso`, hasta el envío a revisión o el cierre);
  - `minutosEspera` suma el tiempo en `en_revision`.
  - Usar la fecha y hora del servidor (`new Date()`) y la zona AR para mostrar.
- **Exportar:** `estadoAtraso(...)`, `acumularTiempos(etapa, de, a, ahora)` y `metricasEtapas(etapas[])`, que devuelve el promedio de trabajo, espera y rondas por nombre de etapa.

### 3.5 Numeración
Igual que en las órdenes de trabajo: `aggregate _max numero` dentro de una transacción, con hasta 3 reintentos si choca el `@@unique`. Se muestra como `PRY-000001`.

---

## 4. API (`apps/api/src/modules/proyectos/`)
**Archivos:**
- `proyectos.module.ts`
- `proyectos.controller.ts`
- `plantillas-proyecto.controller.ts`
- `proyectos.service.ts`
- `plantillas-proyecto.service.ts`
- `proyectos.util.ts`
- `proyectos.util.spec.ts`

Registrar el módulo en `apps/api/src/app.module.ts`, al lado de `OrdenesTrabajoModule`.

**Plan:** agregar `"proyectos"` al tipo `Funcion` y al array `PRO` en `packages/shared-types/src/planes.ts`. Los controladores llevan `@RequireFuncion('proyectos')`.

| Método | Ruta | Para qué | Permiso |
|---|---|---|---|
| GET | `/proyectos?estado=activos\|terminados\|todos&responsableId=&clienteId=&atrasados=1` | Lista con: número, nombre, cliente, responsable, etapa actual (nombre, estado y `falta`), días esperando al cliente, atrasado y días de atraso, fecha comprometida y avance (etapas cerradas sobre total) | — |
| GET | `/proyectos/tablero` | Lo mismo, agrupado por el **nombre** de la etapa actual (columnas en el orden en que aparecen en las plantillas) | — |
| GET | `/proyectos/metricas?desde=&hasta=` | Proyectos terminados en el período: a tiempo (%), atraso promedio, y por etapa los promedios de días trabajando, días esperando y rondas de cambios | — |
| GET | `/proyectos/:id` | Ficha: datos, miembros, etapas con sus aprobaciones y el historial (eventos con el nombre del usuario) | — |
| POST | `/proyectos` | Crear `{ nombre, clienteId?, clienteNombre?, descripcion?, plantillaId?, etapas?: [{nombre, aprobacion, diasObjetivo?, responsableId?, aprobadorInternoId?}], responsableId?, miembros: uuid[], fechaInicio, fechaComprometida?, montoAcordado? }`. Con `plantillaId` y sin `etapas`: se copian de la plantilla | `registrar_ventas` |
| POST | `/proyectos/desde-presupuesto/:presupuestoId` | Igual que en las órdenes: copia el cliente y el total a `montoAcordado`, y deja el presupuesto aceptado | `registrar_ventas` |
| PUT | `/proyectos/:id` | Editar datos generales y miembros (no las etapas) | `registrar_ventas` |
| PUT | `/proyectos/:id/etapas/:etapaId` | Cambiar el responsable, el aprobador interno o la fecha objetivo de una etapa (evento `responsable`) | `registrar_ventas` |
| POST | `/proyectos/:id/etapas` | Agregar una etapa al final o en una posición (`orden`) | `registrar_ventas` |
| POST | `/proyectos/:id/etapas/:etapaId/accion` | `{ accion: 'empezar'\|'enviar_revision'\|'terminar'\|'omitir', nota? }` (`omitir` pide `nota`) | `registrar_ventas` + regla 3.2 |
| POST | `/proyectos/:id/etapas/:etapaId/aprobacion-interna` | `{ resultado: 'aprobada'\|'cambios', version, comentario? }` (`cambios` pide `comentario`) | regla 3.2 |
| POST | `/proyectos/:id/etapas/:etapaId/respuesta-cliente` | `{ resultado, version, aprobadorNombre, medio, aprobadoEn, comentario?, evidenciaUrl? }`. `evidenciaUrl` tiene que ser `https://`, y `aprobadoEn` no puede ser futura | `registrar_ventas` |
| POST | `/proyectos/:id/estado` | `{ estado: 'pausado'\|'activo'\|'terminado'\|'cancelado', motivo? }`. `terminado` solo si todas las etapas están cerradas; `cancelado` pide motivo | `registrar_ventas` |
| GET | `/proyectos/responsables` | Usuarios activos de la empresa (igual que en las órdenes) | — |
| GET | `/plantillas-proyecto` | Plantillas con sus etapas. **Si la empresa no tiene ninguna, crea las de ejemplo (sección 6) y las devuelve** | — |
| POST, PUT | `/plantillas-proyecto`, `/plantillas-proyecto/:id` | Crear o editar una plantilla con sus etapas (reemplaza la lista de etapas entera) | dueño |
| POST | `/plantillas-proyecto/:id/archivar` | `activa = false` (no se borra: hay proyectos que la usaron) | dueño |

**Cada acción que cambia algo:**
- se hace en una **transacción** que actualiza la etapa y el proyecto y agrega el `ProyectoEvento`;
- devuelve la ficha actualizada.

**Mensaje de WhatsApp:** una función `mensajePedidoAprobacion({ cliente, proyecto, etapa, version, negocio })` en `proyectos.util.ts`, que devuelve el texto. Por ejemplo: "Hola Laura! Te paso para revisar «Piezas» (v2) de la Campaña Día de la Madre. ¿Nos confirmás si va o qué cambiarías? — Agencia X". La web arma el link `wa.me` como en las órdenes de trabajo.

---

## 5. Web
### 5.1 Menú
En `apps/web/src/components/shared/app-sidebar.tsx`, grupo Ventas, después de "Órdenes de trabajo":
```ts
{ href: "/proyectos", label: "Proyectos", icon: KanbanSquare, modulo: "ventas", funcion: "proyectos", para: ["servicios"] },
```
El ícono `KanbanSquare` es de `lucide-react`; si no existe en la versión instalada, usar `SquareKanban`.

### 5.2 Rubros
En `apps/web/src/lib/rubros.ts` no hace falta cambiar nada: "profesionales" ya sugiere `servicios`. Cuando exista [[Módulos que se prenden y apagan]], "Proyectos" queda prendido de entrada para los rubros `profesionales` y `oficios`.

### 5.3 Archivos nuevos
```
apps/web/src/app/(dashboard)/proyectos/page.tsx             → <ProyectosVista/>
apps/web/src/app/(dashboard)/proyectos/nuevo/page.tsx       → <NuevoProyecto/>
apps/web/src/app/(dashboard)/proyectos/[id]/page.tsx        → <ProyectoFicha/>
apps/web/src/features/proyectos/use-proyectos.ts            → tipos espejo de la API + hooks de React Query
apps/web/src/features/proyectos/ProyectosVista.tsx          → pestañas Tablero / Lista / Tiempos y filtros
apps/web/src/features/proyectos/TableroProyectos.tsx
apps/web/src/features/proyectos/ListaProyectos.tsx
apps/web/src/features/proyectos/TiemposProyectos.tsx
apps/web/src/features/proyectos/NuevoProyecto.tsx
apps/web/src/features/proyectos/ProyectoFicha.tsx           → cabecera + <EtapasProyecto/> + <HistorialProyecto/>
apps/web/src/features/proyectos/EtapasProyecto.tsx
apps/web/src/features/proyectos/AccionesEtapa.tsx           → botones según el estado y los permisos
apps/web/src/features/proyectos/RespuestaClienteDialog.tsx
apps/web/src/features/proyectos/HistorialProyecto.tsx
apps/web/src/features/proyectos/PlantillasProyectoConfig.tsx → editor de plantillas (Configuración)
```

### 5.4 Pantallas
- **Proyectos, pestaña Tablero:**
  - una columna por etapa actual y una tarjeta por proyecto;
  - cada tarjeta muestra el nombre, el cliente, el avatar o las iniciales del responsable, la fecha comprometida y las etiquetas;
  - etiquetas: 🔴 "Atrasado 3 d", 🟡 "Esperando al cliente · 2 d" y "v3" si hubo cambios;
  - filtros: responsable, cliente y "Solo atrasados";
  - **en el celular**, las columnas pasan a una lista agrupada por etapa, con encabezados plegables. Nada de scroll horizontal.
- **Pestaña Lista:** una tabla ordenable con número, nombre, cliente, etapa actual, responsable, avance (barra), comprometida y atraso.
- **Pestaña Tiempos** (`/proyectos/metricas`):
  - tarjetas de "Terminados", "A tiempo %" y "Atraso promedio", en 2 por fila en el celular (ver [[Tarjetas de 2 por fila en el celular]]);
  - por etapa, barras apiladas de días trabajando y días esperando, más las rondas de cambios promedio;
  - una frase arriba: "La etapa que más demora es «Revisión del cliente»: 4,2 días esperando en promedio".
- **Nuevo proyecto:**
  - formulario con cliente (buscador de clientes existente), nombre, plantilla (select), responsable, equipo (multi), inicio, comprometida y monto acordado (opcional);
  - al elegir la plantilla, la lista de etapas aparece **editable** antes de guardar: nombre, responsable, días, aprobación, y se pueden quitar o agregar;
  - el aviso de la regla 3.3 si las fechas no cierran.
- **Ficha:**
  - cabecera con el estado, la etapa actual, el avance y las fechas;
  - **línea de tiempo vertical de etapas:** cada una con su estado, responsable, fecha objetivo, versión, y sus aprobaciones ("✅ Cliente · Laura Gómez · WhatsApp · v2 · 12/11 15:30", con el comentario y el link de evidencia);
  - botones según el estado (`AccionesEtapa`) y "Pedir aprobación por WhatsApp";
  - abajo, el **historial** completo (`HistorialProyecto`).
- **Configuración → "Mi negocio" → Proyectos:** opción nueva en `ConfiguracionVista.tsx`, con `funcion: "proyectos"`. Si el objeto `Opcion` acepta `para`, sumar `para: ["servicios"]`. Ojo: en `main` (`9384b29`) los grupos son "Ventas y cobros", "Productos y stock", "Tienda online", "Mi negocio" y "Equipo y datos". Muestra `PlantillasProyectoConfig`:
  - lista de plantillas;
  - editor de etapas con flechas ↑↓ para el orden (sin arrastrar, para que ande bien en el celular);
  - por cada etapa: nombre, días objetivo, aprobación (Ninguna, Interna, Cliente, Interna y después cliente) y aprobador interno por defecto.

### 5.5 Inicio (opcional, si sobra tiempo)
Una tarjeta "Proyectos" en `apps/web/src/app/(dashboard)/inicio/page.tsx` con la cantidad de atrasados y esperando al cliente, y los 3 más atrasados. Solo si la empresa tiene la función `proyectos` y al menos un proyecto activo.

---

## 6. Plantillas de ejemplo (se crean solas la primera vez)
Las devuelve `GET /plantillas-proyecto` si la empresa no tiene ninguna. Están armadas con prácticas de agencias; el dueño las edita.

| Plantilla | Etapas (días objetivo · aprobación) |
|---|---|
| **Campaña** | Brief (2 · cliente) → Estrategia (3 · ambas) → Piezas (5 · interna) → Revisión del cliente (3 · cliente) → Ajustes finales (2 · interna) → Publicación (1 · ninguna) → Informe de resultados (5 · cliente) |
| **Redes mensual** | Planificación del mes (3 · ambas) → Producción de piezas (7 · interna) → Aprobación del calendario (2 · cliente) → Publicación y comunidad (30 · ninguna) → Informe mensual (3 · cliente) |
| **Branding** | Brief y referencias (3 · cliente) → Investigación (5 · ninguna) → Propuestas de concepto (7 · ambas) → Desarrollo del elegido (7 · interna) → Aprobación final (3 · cliente) → Manual de marca y entrega (5 · interna) |
| **Genérico** | Inicio (· ninguna) → Desarrollo (· interna) → Revisión del cliente (· cliente) → Entrega (· ninguna) |

---

## 7. Pruebas
### 7.1 Unitarias (`proyectos.util.spec.ts`)
- `transicionEtapa`:
  - todos los caminos del diagrama de 3.1, incluido `ambas` (interna aprueba → falta cliente → cliente aprueba);
  - no se puede empezar una etapa que no es la actual;
  - pedir cambios suma versión y rondas;
  - aprobar con una versión vieja da error.
- Regla 3.2: el que envió no puede aprobar adentro (salvo el dueño).
- `fechasObjetivo`: suma de días, etapas sin días y el aviso cuando se pasa de la comprometida.
- `estadoAtraso`: activo atrasado, terminado tarde, terminado a tiempo y esperando al cliente.
- `acumularTiempos`: trabajo y espera con dos rondas de cambios.
- `metricasEtapas`: promedios por nombre de etapa.
- `mensajePedidoAprobacion`: con cliente y sin cliente.

### 7.2 De punta a punta (`apps/api/test/proyectos.e2e-spec.ts`, como `ordenes-trabajo.e2e-spec.ts`)
- **Flujo completo:**
  1. crear desde la plantilla Campaña;
  2. empezar Brief, enviar, el cliente aprueba;
  3. Estrategia: la interna aprueba, el cliente pide cambios, v2, la interna aprueba, el cliente aprueba;
  4. omitir Informe y terminar.
  El historial tiene todos los eventos en orden.
- **Aislamiento:** la empresa B no ve ni modifica proyectos de la A (404).
- **Plan:** una empresa en plan Básico recibe 403 en `/proyectos`.
- **Permisos:** un colaborador sin `registrar_ventas` no puede hacer acciones; un no-dueño no puede editar plantillas.
- **Desde presupuesto:** copia el cliente y el monto, y el presupuesto queda aceptado.

### 7.3 Comandos
```bash
pnpm --filter api exec prisma migrate dev --name proyectos
pnpm --filter api lint && pnpm --filter api test && pnpm --filter api build
pnpm --filter web lint && pnpm --filter web typecheck
pnpm --filter api test:e2e -- proyectos
```
El nombre exacto del script de punta a punta está en `apps/api/package.json`.

### 7.4 A mano (en la compu, con Docker)
- Crear una empresa de prueba de rubro "Servicios profesionales" en plan Pro, con 3 usuarios: dueño, creativo y ejecutivo de cuentas.
- Hacer el flujo de la sección 1 entero, en computadora y en el celular (390 px).
- Revisar la bitácora de auditoría (Consola → Auditoría): aparecen las aprobaciones.

---

## 8. Fuera de esta fase (no hacer ahora)
- **Fase 2 · La plata:**
  - carga de horas por persona, proyecto y etapa;
  - costo por hora de cada persona;
  - gastos del proyecto, con la pauta publicitaria marcada como refacturable;
  - margen, horas presupuestadas contra reales y utilización.
- **Fase 3 · Lo fino:**
  - **link de aprobación para el cliente sin usuario**, con un token firmado como `tokenTurno` en `apps/api/src/modules/agenda/agenda.util.ts` y una página pública en `apps/web/src/app/aprobar/[token]/page.tsx`, agregada a `isPublicRoute` en `apps/web/src/proxy.ts`. El modelo ya tiene `medio = 'link'`;
  - pedidos extra fuera del alcance;
  - bolsa de horas en los abonos;
  - alertas: "lleva 3 días esperando al cliente".

---

## 9. Terminado cuando…
- [ ] Migración aplicada en la compu, sin tocar otras tablas.
- [ ] `proyectos` en el plan Pro, en el menú (solo servicios) y en Configuración.
- [ ] Plantillas de ejemplo creadas solas y editables por el dueño.
- [ ] Crear un proyecto desde una plantilla y desde un presupuesto.
- [ ] Todos los estados de la etapa, con las reglas 3.1 y 3.2.
- [ ] Respuesta del cliente con quién, medio, versión, fecha, comentario y evidencia.
- [ ] Tablero, Lista y Tiempos con atrasos y espera al cliente, también en el celular.
- [ ] Historial completo en la ficha, y las tablas en la bitácora de auditoría y en exportar y borrar los datos.
- [ ] Pruebas unitarias y de punta a punta en verde, y lint, tipos y build OK.
- [ ] Pull Request abierto (no push directo a `main`), con capturas de computadora y celular.

## Hecho por el hermano
- Fecha:
- Pull Request / commit:
- Qué cambió respecto del plan:
