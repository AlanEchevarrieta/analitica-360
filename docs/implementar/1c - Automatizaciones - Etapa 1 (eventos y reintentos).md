---
tags: [analitica360, para-implementar, agente, automatizacion]
estado: para hacer
creado: 2026-11-03
base: main 9384b29 (2026-11-01)
---
# Automatizaciones · Etapa 1: eventos y cola con reintentos
Volver a [[Para implementar]] · Contexto: [[Automatizaciones (propuesta)]] · Va junto con: [[Robustez y seguridad antes del piloto]]

> **Para el hermano de Alan y sus agentes de IA.** Pasale el documento entero al agente. Claude lo armó leyendo `main` (`9384b29`); Claude no tocó código.
>
> **Decidido por Alan (2026-11-03):** "sí a todo" en [[Automatizaciones (propuesta)]]. **Regla: costo cero.** Nada que haya que pagar: ni servicios nuevos, ni Redis, ni otro servidor, ni la API paga de WhatsApp.

## 0. Instrucciones para el agente (leer primero)
**Objetivo:** que Analítica 360 tenga **una sola forma** de hacer las cosas "en segundo plano" (mandar emails, avisos y, más adelante, las recetas de automatización):
- **que no se pierda nada:** cada evento queda guardado en la base dentro de la misma transacción;
- **que se reintente si falla,** con espera creciente;
- **que se vea qué pasó:** un historial y una pantalla en la Consola.

Esta etapa **no tiene pantallas para el comercio.** Es la base de las recetas de la Etapa 2.

**Reglas:**
1. **Costo cero:**
   - **solo Postgres** (la cola es una tabla, con `FOR UPDATE SKIP LOCKED`);
   - el trabajador corre **dentro de la API** (ningún contenedor ni servicio nuevo);
   - los emails, por Resend (plan gratis).
2. **Rama** `feat/eventos-reintentos` y Pull Request. No subir directo a `main`.
3. **Paso 0, verificar:** buscar en `main` si ya existe algo parecido (`eventos`, `outbox`, `cola`, `bullmq`, `SKIP LOCKED`). Si existe, adaptarlo en lugar de duplicarlo.
4. **Seguir el estilo del repo:**
   - módulos NestJS con `*.util.ts` y su `*.util.spec.ts`;
   - Prisma con `@@map` y `snake_case`;
   - Zod;
   - siempre `empresaId`;
   - textos en español simple.
5. **Copiar los patrones que ya funcionan en el repo:**
   - **Reservar sin chocar:** `InformesService.tomar()` en `apps/api/src/modules/informes/informes.service.ts` (`INSERT … ON CONFLICT DO NOTHING` y reintento con `intentos < MAX`).
   - **Registrar manejadores:** `this.documentos.registrar('orden_trabajo', …)` en `ordenes-trabajo.service.ts` (`onModuleInit`).
   - **Programador:** `informes.programador.ts` (`setInterval` con `unref()`, la bandera `corriendo`, una variable para apagarlo y `process.env.VITEST`).
6. **No cambiar el comportamiento visible:** los mismos emails, a las mismas personas y con el mismo texto. Solo que ahora no se pierden.

## 1. El problema que arregla (visto en `main`)
- **Cada módulo manda emails por su cuenta,** con `fetch('https://api.resend.com/emails')` o similar, en al menos 10 servicios: `informes`, `archivo`, `objetivos`, `agenda-online`, `arca/facturacion`, `documentos`, `planes/precios-plan`, `registro`, `vencimientos` y `tienda/cuentas-tienda`.
- **Si Resend falla o no hay clave, cada uno hace algo distinto:**
  - los informes quedan en **`sin_servicio`** y **no se reintentan nunca** (`informes.service.ts`, línea ~205). Así se perdieron los del 5, 12 y 19/10 ([[Lecciones aprendidas]]);
  - los avisos de vencimientos "no hacen nada" (`archivo.service.ts`, línea ~205).
- **Hay 7 programadores con `setInterval`:** archivo, bajas, informes, mercadopago, objetivos, precios-plan y vencimientos. Cada uno con su propia forma de reintentar, o sin reintentos.

## 2. Base de datos (Prisma)
**Archivo:** `apps/api/prisma/schema.prisma`. **Migración:** `2026MMDDHHMMSS_eventos`.

```prisma
/// Cola de eventos (outbox): lo que hay que hacer en segundo plano. Se escribe en la misma transacción que el cambio que lo origina.
model Evento {
  id               String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  /// null = evento del sistema (no de una empresa)
  empresaId        String?   @map("empresa_id") @db.Uuid
  /// p. ej. correo.enviar, informe.semanal, vencimiento.aviso (ver 3.3)
  tipo             String    @db.VarChar(60)
  payload          Json
  /// Para no duplicar: el mismo (empresa, tipo, clave) se guarda una sola vez. Ej.: "informe:semanal:2026-10-26"
  clave            String?   @db.VarChar(200)
  /// pendiente | procesando | hecho | fallo | descartado
  estado           String    @default("pendiente") @db.VarChar(12)
  intentos         Int       @default(0)
  maxIntentos      Int       @default(6) @map("max_intentos")
  /// Cuándo se puede tomar (para reintentos con espera y para eventos programados a futuro)
  disponibleDesde  DateTime  @default(now()) @map("disponible_desde")
  /// Si un trabajador lo tomó y se cayó, después de esto otro lo puede retomar
  bloqueadoHasta   DateTime? @map("bloqueado_hasta")
  ultimoError      String?   @map("ultimo_error") @db.VarChar(1000)
  creadoEn         DateTime  @default(now()) @map("creado_en")
  procesadoEn      DateTime? @map("procesado_en")
  ejecuciones      EventoEjecucion[]
  @@unique([empresaId, tipo, clave])
  @@index([estado, disponibleDesde])
  @@index([empresaId, creadoEn])
  @@map("eventos")
}

/// Historial de cada intento (para la Consola y, en la Etapa 2, para "Automatizaciones → Historial" del comercio)
model EventoEjecucion {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  eventoId   String   @map("evento_id") @db.Uuid
  intento    Int
  /// ok | error | omitido
  resultado  String   @db.VarChar(8)
  /// Ej.: "email a dueño@x.com", "sin destinatarios"
  detalle    String?  @db.VarChar(500)
  error      String?  @db.VarChar(1000)
  duracionMs Int      @map("duracion_ms")
  creadoEn   DateTime @default(now()) @map("creado_en")
  evento     Evento   @relation(fields: [eventoId], references: [id], onDelete: Cascade)
  @@index([eventoId])
  @@map("eventos_ejecuciones")
}

/// Recetas prendidas por empresa (se llena en la Etapa 2; en esta etapa solo se crea la tabla)
model Automatizacion {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  empresaId String   @map("empresa_id") @db.Uuid
  receta    String   @db.VarChar(60)
  activa    Boolean  @default(false)
  config    Json     @default("{}")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  @@unique([empresaId, receta])
  @@map("automatizaciones")
}
```

**Además:**
- **Limpieza:** los eventos `hecho` y sus ejecuciones se borran a los **30 días**; los de `fallo`, a los **90 días**. Lo hace el mismo trabajador una vez por día. Así la tabla no crece sin fin, y no hay que pagar más disco.
- **Exportar y borrar los datos de una empresa:** sumar `eventos` y `automatizaciones` donde se borran los datos de una empresa (`bajas`).

## 3. Módulo `apps/api/src/modules/eventos/`
**Archivos:**
- `eventos.module.ts` (global, `@Global()`, para que cualquier módulo pueda emitir)
- `eventos.service.ts` (emitir y manejadores)
- `eventos.trabajador.ts` (el que procesa)
- `eventos.util.ts` (espera entre reintentos, clasificación de errores y recorte de textos)
- `eventos.util.spec.ts`
- `correo.service.ts` (único lugar que habla con Resend)
- `eventos-admin.controller.ts` (Consola)

Registrarlo en `apps/api/src/app.module.ts`.

### 3.1 Emitir un evento
```ts
// eventos.service.ts
emitir(db: Prisma.TransactionClient | PrismaService, e: {
  empresaId: string | null; tipo: TipoEvento; payload: object;
  clave?: string;            // para no duplicar (ON CONFLICT DO NOTHING)
  disponibleDesde?: Date;    // para programarlo a futuro (p. ej. recordatorio de turno 24 h antes)
}): Promise<{ id: string } | null>   // null si ya existía (misma clave)
```
- **Siempre con el `db` de la transacción del cambio que lo origina.** Si la venta no se guarda, el evento tampoco.
- Insertar con `$executeRaw … ON CONFLICT (empresa_id, tipo, clave) DO NOTHING`. Ojo: el `@@unique` con `empresaId` null no choca en Postgres. Para los eventos del sistema, usar la clave igual y validar en código.

### 3.2 El trabajador
- **Cuándo corre:** cada **15 segundos**, dentro de la API, con `setInterval` + `unref()`, igual que `informes.programador.ts`. Se apaga con `EVENTOS_TRABAJADOR=0` (sumarla en `apps/api/src/config/env.validation.ts`, con `'1'` por defecto). Y no corre en las pruebas (`process.env.VITEST`).
- **Tomar hasta 20 eventos** en una transacción corta:
  ```sql
  UPDATE eventos SET estado = 'procesando', intentos = intentos + 1, bloqueado_hasta = now() + interval '5 minutes'
  WHERE id IN (
    SELECT id FROM eventos
    WHERE (estado = 'pendiente' AND disponible_desde <= now())
       OR (estado = 'procesando' AND bloqueado_hasta < now())   -- se cayó un trabajador
    ORDER BY disponible_desde
    LIMIT 20
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
  ```
  Con `SKIP LOCKED` es seguro aunque mañana haya dos servidores.
- **Para cada evento:**
  1. busca el manejador de su `tipo`;
  2. lo ejecuta con un **límite de 60 segundos**;
  3. guarda una fila en `eventos_ejecuciones`.
- **Si sale bien:** `estado = 'hecho'` y `procesadoEn = now()`.
- **Si falla:**
  - error **definitivo** (dato inválido, empresa borrada, email mal escrito): `estado = 'fallo'`, sin reintentar;
  - error **temporal** (red, Resend caído, 429 o 5xx, falta `RESEND_API_KEY`): `estado = 'pendiente'` y `disponibleDesde = now() + espera(intentos)`;
  - si `intentos >= maxIntentos`: `estado = 'fallo'`.
- **Espera** (`eventos.util.ts → espera(intento)`): 1 min, 5 min, 30 min, 2 h, 12 h y 24 h, con ±10 % al azar para que no salgan todos juntos.
- **Sin `RESEND_API_KEY`:** el evento de correo **queda pendiente** y se reintenta cada 24 horas, hasta 35 días.
  - **Es el arreglo de los informes perdidos:** cuando se cargue la clave de Resend, salen solos.
  - Los informes de más de 35 días se descartan (`descartado`), porque ya no tiene sentido mandarlos.

### 3.3 Tipos de eventos de esta etapa
| Tipo | Lo emite | Lo hace |
|---|---|---|
| `correo.enviar` | cualquier módulo | `CorreoService.enviar({ para, asunto, html, adjuntos?, responderA? })` → Resend. Un evento por destinatario, para reintentar solo al que falló |
| `informe.enviar` | `informes.programador` (en lugar de mandar directo) | arma el PDF y emite un `correo.enviar` por destinatario |
| `vencimiento.aviso` | `archivo.programador` y `vencimientos.programador` | arma el texto y emite `correo.enviar` |
| `objetivo.aviso` | `objetivos.programador` | ídem |
| `precio.aviso` | `precios-plan.programador` (el aviso de aumento con 30 días) | ídem |

**No pasar a eventos en esta etapa:**
- los **códigos de ingreso** de las tiendas (`cuentas-tienda.ts`): el usuario está esperando en la pantalla y tiene que ser al instante;
- las **bajas**, la **cotización del dólar** y el programador de **Mercado Pago**: no mandan mensajes.

Quedan como están.

### 3.4 `CorreoService` (un solo lugar para Resend)
- Un solo método, `enviar(...)`, que devuelve `{ ok: true, id } | { ok: false, temporal: boolean, error }`.
- **Clasifica el error:** 429, 5xx, red o falta de clave son temporales; 4xx de validación es definitivo.
- Remitente: `AVISOS_EMAIL_DESDE` (ya existe).
- **Plan gratis de Resend:** tiene un tope de emails por día y por mes (confirmarlo en su página). Si Resend responde que se pasó del tope, es un error **temporal**: se reintenta mañana, no se pierde.
- Los servicios que hoy llaman a Resend directo pasan a **emitir `correo.enviar`**. Los códigos de ingreso de la tienda usan `CorreoService.enviar()` directo (al instante, sin cola).

### 3.5 Los informes, sin perderse
En `informes.service.ts`:
- `enviarRegistro` ya no manda: emite `informe.enviar` con la clave `informe:{tipo}:{desde}`.
- El manejador de `informe.enviar` hace lo que hoy hace `enviarRegistro`, y deja `informes_enviados` como registro de lo que se mandó.
- **Los `sin_servicio` que ya existen** (5, 12 y 19/10, y los que se sumen): una migración de datos, o una función que corre una vez, los pasa a eventos `pendiente`, solo si tienen menos de 35 días. Si no, quedan como están.

## 4. Consola (solo administradores de Analítica 360)
- **`GET /admin/eventos?estado=&tipo=&empresaId=`:** la lista con estado, intentos, último error y fechas.
- **`GET /admin/eventos/resumen`:** cuántos pendientes, en fallo y hechos en 24 h, por tipo.
- **`POST /admin/eventos/:id/reintentar`:** vuelve a `pendiente`, con `disponibleDesde = now()` e `intentos = 0`.
- **`POST /admin/eventos/:id/descartar`.**
- Seguir el patrón de los otros controladores de `/admin`, con su guard de administrador.

**Web:** `apps/web/src/app/(consola)/…` → **Consola → Sistema → Eventos**:
- tarjetas de pendientes, en fallo y hechos hoy, de a 2 por fila en el celular;
- una tabla con filtros;
- los botones Reintentar y Descartar.

**En Consola → Resumen:** si hay eventos en `fallo` en las últimas 24 h, un aviso arriba que dice "⚠️ 3 tareas fallaron" (Andon).

## 5. Pruebas
- **Unitarias (`eventos.util.spec.ts`):**
  - `espera(n)` da los tiempos de 3.2, dentro del ±10 %;
  - la clasificación de errores: 429, 503, red y sin clave son temporales; 400 y 422 son definitivos;
  - el recorte de textos largos en `ultimoError`.
- **Del trabajador** (con la base de prueba, como las otras de punta a punta):
  - emitir dentro de una transacción que se deshace **no deja evento**;
  - la misma `clave` dos veces deja **un solo evento**;
  - un manejador que falla 2 veces y después anda queda `hecho`, con 3 ejecuciones;
  - un error definitivo queda en `fallo` de una;
  - **dos trabajadores a la vez no toman el mismo evento** (dos `tomar()` en paralelo);
  - un evento `procesando` con `bloqueadoHasta` vencido se retoma;
  - sin `RESEND_API_KEY`, el correo queda `pendiente` y no en `fallo`.
- **De los informes:** la semana sin clave queda pendiente; al cargar la clave (cambiar la variable en la prueba) se manda.
- **Aislamiento:** `/admin/eventos` da 403 para un usuario común.
- **Comandos:**
  ```bash
  pnpm --filter api lint && pnpm --filter api test && pnpm --filter api build
  pnpm --filter web lint && pnpm --filter web typecheck
  ```
- **A mano en la compu:**
  1. sin `RESEND_API_KEY`, forzar un informe: queda pendiente en Consola → Eventos;
  2. cargar la clave con el acceso "Cargar clave de Resend" del Escritorio de Alan, o en `.env`: sale solo en el próximo intento;
  3. **ojo:** en el plan gratis de Resend sin dominio verificado, solo llega al email de la cuenta.

## 6. Terminado cuando…
- [ ] Tablas `eventos`, `eventos_ejecuciones` y `automatizaciones` con su migración.
- [ ] `emitir()` dentro de las transacciones y el trabajador con `SKIP LOCKED`, reintentos y bloqueo vencido.
- [ ] `CorreoService` único; los 9 servicios que mandaban por su cuenta emiten `correo.enviar` (menos los códigos de ingreso, que van directo).
- [ ] Los informes `sin_servicio` de menos de 35 días se mandan solos cuando aparece la clave.
- [ ] Consola → Sistema → Eventos, con reintentar y descartar, y el aviso en Resumen.
- [ ] Limpieza automática a los 30 y 90 días.
- [ ] Pruebas en verde. **Costo cero:** sin Redis, sin servicios ni contenedores nuevos.
- [ ] Pull Request abierto, con capturas de la Consola.

## Lo que sigue (no hacer ahora)
- **Etapa 2:** las 5 recetas para los clientes (reponer stock, cuota vencida, gracias por tu compra, recordatorio de turno y resumen del día), con Configuración → Automatizaciones y su historial. **WhatsApp con links** que el comercio toca (gratis), no la API paga.
- **Etapa 3:** webhooks que salen, firmados, y la API pública con claves por empresa. n8n para nosotros, **en el mismo servidor** con un límite de memoria, solo si alcanza. Si no, esperar: no se paga otro servidor.

## Hecho por el hermano
- Fecha:
- Pull Request / commit:
- Qué cambió respecto del plan:
