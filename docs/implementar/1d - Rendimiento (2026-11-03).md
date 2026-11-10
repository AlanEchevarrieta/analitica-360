---
tags: [analitica360, para-implementar, agente, rendimiento]
estado: para hacer
creado: 2026-11-03
base: main 9384b29 + analitica360.app medida el 2026-11-03
---
# Rendimiento: lo medido y lo que hay que ajustar (costo cero)
Volver a [[Para implementar]] · Objetivo: **1. Publicado y estable**

> **Para el hermano de Alan y sus agentes de IA.** Claude midió la página publicada desde Mendoza y leyó la auditoría del 2/11; no tocó código ni el servidor. **Todo lo de acá es gratis.**
>
> **Paso 0:** antes de cada punto, verificar si ya está hecho, con el comando que figura en cada uno.

## 1. Lo que se midió
| Qué | Resultado | Cómo está |
|---|---|---|
| **Archivos de la página** (`/_next/static/*.js`, 17 en la landing) | `Cache-Control: private, no-cache, no-store` y Cloudflare `BYPASS` | 🔴 **Se descargan de cero en cada visita y en cada pantalla.** Next.js, cuando corre bien, los marca para guardarse un año |
| **Compresión** | Brotli activa: la landing pesa 44 KB comprimida (275 KB sin comprimir) | 🟢 |
| **Primer byte desde Mendoza** | Unos 0,23 a 0,33 s, en la web y en la API. La conexión más el cifrado ya son 0,12 a 0,16 s, porque el servidor está en Ashburn (EE. UU.) | 🟡 Normal para esa distancia. Cada pedido a la API paga ese viaje |
| **Auditoría del 2/11, 30 usuarios (en la compu de Alan)** | p95 **265 ms**, p99 **1.244 ms**. Lo más lento: **productos 762 ms**, analytics 656 ms y movimientos 477 ms. En octubre el p95 daba entre 17 y 44 ms | 🟡 **Diez veces más lento que en octubre.** En la misma corrida, con 100 usuarios, dio p95 41 ms: parece que las primeras consultas arrancan "en frío" |
| **Base en la compu** | 116.338 filas en 101 tablas | 🟢 Chica todavía |
| **Postgres** | `shared_buffers` en 128 MB, el valor por defecto, en un servidor de 4 GB ([[Pendientes]], 8/10) | 🟡 Desaprovecha memoria |

## 2. Qué hacer, en orden de impacto

### A. 🔴 Que el navegador y Cloudflare guarden los archivos (lo más importante)
**Paso 0, verificar:**
```bash
curl -sI https://analitica360.app/_next/static/chunks/<cualquiera>.js | grep -i cache-control
```
Tiene que decir `public, max-age=31536000, immutable`. Hoy dice `private, no-cache, no-store`.

**Dónde buscar** (no está en `apps/web/next.config.ts`, que solo pone las cabeceras de seguridad):
1. **nginx del servidor:** buscar `add_header Cache-Control` o `expires` en la configuración del sitio. Puede venir del arreglo del 1/11 que desactivó el *service worker* ("prevenir interrupciones en la navegación").
2. **Cloudflare → Caching → Cache Rules o Page Rules:** que no haya una regla "Bypass cache" o "Cache level: bypass" para todo el sitio.
3. **Cómo corre la web en el servidor:** confirmar que sea `next start` (producción), no `next dev`. Las cabeceras de hoy son las que usa Next en modo desarrollo, aunque no se ven otros rastros del modo desarrollo.

**Cómo tiene que quedar:**
- `/_next/static/*` → `Cache-Control: public, max-age=31536000, immutable` (los nombres cambian en cada versión, así que es seguro).
- Las fotos de productos (`/uploads/*` o donde estén) → `public, max-age=604800` (7 días).
- `/manifest.json`, los íconos y `sw.js` → `public, max-age=3600`. **`sw.js` nunca con `immutable`.**
- Las páginas HTML y la API → **sin cache** (como hoy): llevan datos de cada usuario.
- En Cloudflare: una Cache Rule "Cache everything" **solo** para `analitica360.app/_next/static/*`, con *Edge TTL* de 1 mes.

**Por qué importa:** cada pantalla vuelve a bajar todos los archivos de la app. En un celular con 4G, o en el stand con mala señal, es lo que más se nota. Arreglado, la segunda visita carga casi al instante.

### B. 🟡 Postgres usando la memoria que tiene (gratis)
**Paso 0, verificar:** `docker compose -f docker-compose.prod.yml exec postgres psql -U <usuario> -c "SHOW shared_buffers;"`.

**Con un servidor de 4 GB** donde también corren la API, la web, la tienda y nginx, valores prudentes:
- `shared_buffers = 768MB`
- `effective_cache_size = 2GB`
- `work_mem = 8MB`
- `maintenance_work_mem = 128MB`
- `random_page_cost = 1.1` (disco SSD)

Van en `command:` del servicio `postgres` en `docker-compose.prod.yml`, por ejemplo `-c shared_buffers=768MB`. **Copia de la base antes** y reiniciar en un horario sin ventas.

**Sumar `pg_stat_statements`** (viene con Postgres, gratis) para ver qué consultas tardan más:
- `shared_preload_libraries=pg_stat_statements`;
- `CREATE EXTENSION pg_stat_statements;`.

### C. 🟡 Investigar por qué "productos" tardó 762 ms
**Paso 0:** correr `pnpm auditar -- --solo carga` dos veces seguidas en la compu de Alan.
- **Si la segunda da como en octubre** (p95 menos de 50 ms), era el arranque en frío: sumar una **"entrada en calor"** de 20 segundos al principio de la prueba de k6 (`scripts/auditoria/`), para que no dé falsas alarmas.
- **Si sigue lento:** mirar qué se le agregó al listado de productos desde octubre (radar de precios, enlaces a Mercado Libre y los campos de servicios).
  - ¿Hace una consulta por producto (N+1)?
  - ¿Calcula el stock (suma de movimientos) para todos, sin límite ni página?
  - `EXPLAIN ANALYZE` de la consulta y los índices que falten, por ejemplo `movimientos_inventario(empresa_id, producto_id)`.

### D. 🟡 Menos viajes a la API por pantalla (por el servidor lejos)
Como el servidor está en EE. UU., **cada pedido cuesta unos 0,25 s** desde Argentina. Mudarlo sale plata, así que se descarta (costo cero). En cambio:
- **Inicio y Analytics:** si una pantalla hace 5 o 6 pedidos uno detrás del otro, hacerlos **en paralelo** (React Query lo hace si no dependen entre sí) o juntarlos en un solo endpoint.
- **React Query:** `staleTime` de 30 a 60 s en lo que no cambia a cada rato (configuración, planes, categorías y usuarios), para no volver a pedirlo en cada pantalla.
- **Prefetch:** al pasar el mouse o tocar el menú, pedir los datos de la pantalla siguiente (`queryClient.prefetchQuery`).
- **Medir:** con Chrome → DevTools → Network, contar los pedidos de Inicio y de Ventas antes y después.

### E. ⚪ Fotos más livianas
Ya se guardan en WEBP (1.600 px y miniatura de 640 px). Revisar que **los listados usen la miniatura** y no la grande, y que tengan `loading="lazy"`.

## 3. Cómo probar
- **A:** `curl -sI` a un archivo de `/_next/static/` da `public, max-age=31536000, immutable`, y en la segunda carga Cloudflare da `HIT`. En Chrome (Network, "Disable cache" apagado), la segunda visita muestra los JS "(memory cache)" o "(disk cache)".
- **B:** `SHOW shared_buffers` da `768MB` y la app anda igual.
- **C:** la auditoría de carga en 🟢, con p95 menos de 100 ms en 30 usuarios.
- **D:** Inicio hace menos pedidos y carga más rápido en el celular.
- **Antes y después,** con Chrome → Lighthouse (modo celular) en `https://analitica360.app/` y en `/inicio` (logueado). Anotar el puntaje y el "Largest Contentful Paint" en "Hecho por el hermano".

## 4. Terminado cuando…
- [ ] A: los archivos estáticos se guardan un año y Cloudflare los sirve (`HIT`).
- [ ] B: Postgres ajustado, con `pg_stat_statements` prendido.
- [ ] C: la causa de los 762 ms encontrada (arranque en frío o consulta) y arreglada.
- [ ] D: Inicio y Analytics con los pedidos en paralelo, y `staleTime` en lo que casi no cambia.
- [ ] Lighthouse antes y después anotado. **Sin gastar plata.**

## Hecho por el hermano
- Fecha:
- Pull Request / cambios en el servidor:
- Qué cambió respecto del plan (y los números de Lighthouse):
