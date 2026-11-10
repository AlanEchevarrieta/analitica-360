---
tags: [analitica360, para-implementar, propuesta]
estado: para hacer
creado: 2026-11-03
---
# Módulos que se prenden y apagan (estilo Odoo)
Volver a [[Para implementar]] · Relacionado: [[Analítica 360 vs Odoo]]

> Basado en `main` de GitHub (`9384b29`). **Claude no tocó código.** Todo decidido por Alan el 2026-11-03.

## La idea (propuesta del hermano de Alan)
Que cada comercio prenda solo los módulos que necesita, como las "Aplicaciones" de Odoo. Así el sistema no se ve recargado y no hace falta construir cosas para todos.

## Opinión de Claude: sí, y es más barato de lo que parece
**Ya existen 2 de las 3 piezas.** No hay que inventar un sistema nuevo, sino sumar una capa:

| Capa | Qué hace hoy | Dónde está |
|---|---|---|
| **Plan** | Bloquea con candado lo que el plan no incluye | `packages/shared-types/src/planes.ts` (`funciones` de cada plan) y `plan.incluye()` en el menú |
| **Qué hace el negocio** | Esconde según productos, fabricación o servicios (por ejemplo, Agenda solo si da servicios) | `actividades` en `configuracion_empresa` (`schema.prisma`, línea ~314); `para: [...]` en `app-sidebar.tsx`; `apps/web/src/lib/rubros.ts` |
| **Módulos (nuevo)** | Que el dueño prenda o apague cada módulo a mano | — |

**Por qué no es sobreingeniería:**
- **Lo que hay que agregar es poco:** un campo en la base, una pantalla de interruptores y un filtro más en el menú.
- **Ataca un problema real:** el menú ya tiene unas 20 secciones, y con Caja, Copilot y Radar de precios va a seguir creciendo. Un monotributista con un local no necesita Producción, Comisiones ni Abonos.
- **Hace la incorporación más simple** (piloto UCIM y curso): se arranca con 4 o 5 módulos y se suman a medida que los aprenden.

**Dónde sí sería sobreingeniería:** copiar Odoo de verdad, con módulos que se instalan, se actualizan y tienen su propia base de datos. Acá **apagar = esconder**: los datos quedan y la API no cambia.

## Cómo funcionaría
1. **Configuración → Módulos:** una lista con interruptores, agrupada como el menú (Ventas, Stock y compras, Gestión, Tienda). Cada módulo con su ícono y una frase de para qué sirve.
2. **Lo que queda prendido de entrada** sale de "Qué hace mi negocio": se usa la tabla `para` que ya existe. Después el dueño lo ajusta.
3. **Si el plan no lo incluye:** el interruptor aparece con candado y "Disponible en Pro". Es otra forma de mostrar los planes.
4. **Siempre prendidos:** Inicio, Ventas, Productos, Configuración, Planes y Soporte.
5. **Dependencias:** al prender un módulo se prende lo que necesita, con un aviso. Por ejemplo:
   - Comisiones necesita Agenda;
   - Producción necesita Inventario;
   - Tienda online necesita Productos;
   - Pedidos necesita Inventario.
6. **Apagar no borra nada.** Se esconde del menú y de los accesos de Inicio. Lo que pasa por debajo (por ejemplo, que la venta descuente stock) sigue igual. Aviso: "Se esconde del menú. Tus datos quedan y lo podés volver a prender cuando quieras".

## Módulos propuestos (según el menú actual)
| Grupo | Módulos |
|---|---|
| Ventas | Caja y turnos · Cobros · Clientes · Pedidos · Agenda · Abonos · Órdenes de trabajo · Comisiones |
| Stock y compras | Inventario · Compras · Proveedores · Producción |
| Gestión | Analytics · Objetivos · Documentos |
| Online | Tienda online · Mercado Pago · Envíos |
| Extras | Copilot IA · Radar de precios |

## Qué archivos tocar
1. **Base:** en `configuracion_empresa`, un campo `modulos Json @default("{}")` con lo que el dueño cambió a mano, por ejemplo `{ "produccion": false, "agenda": true }`.
   - **Lo efectivo** es lo que cambió el dueño y, si no cambió nada, lo que sale de `actividades`.
   - Así un módulo nuevo que se agregue al sistema aparece solo según el rubro, sin migrar datos.
2. **Tipos compartidos:** la lista de módulos con sus dependencias y su grupo en `packages/shared-types`, para que la usen la web y la API.
3. **API (`apps/api/src/modules/configuracion/`):**
   - `configuracion.dto.ts`: aceptar `modulos`, validado con Zod contra la lista;
   - repositorio: guardarlo;
   - devolver `modulosEfectivos` ya calculado.
4. **Web:**
   - `app-sidebar.tsx`: además de `para` y `plan.incluye()`, filtrar por `modulosEfectivos`. Cada ítem ya tiene `modulo` o `funcion`; se puede usar una clave `moduloId` explícita;
   - `ConfiguracionVista.tsx`: opción "Módulos" en el grupo "Mi negocio", al lado de "Qué hace mi negocio";
   - Inicio y accesos rápidos: no mostrar accesos a módulos apagados.
5. **Registro:** después de elegir el rubro, mostrar "Esto es lo que vas a usar" con los módulos sugeridos y la opción de cambiarlos.
6. **Consola → Uso:** ver qué módulos prende y apaga cada cliente. Sirve para decidir qué mejorar.

## Cómo probar
- **Empresa de servicios nueva:** arranca con Agenda, Abonos y Órdenes prendidos, y sin Producción ni Compras.
- **Apagar Inventario:** desaparece del menú y las ventas siguen descontando stock. Al prenderlo de nuevo están todos los movimientos.
- **Prender Comisiones:** se prende Agenda con su aviso.
- **Plan Básico:** lo que es de Pro aparece con candado y no se puede prender.
- **Aislamiento entre empresas:** lo que prende una empresa no cambia a otra.

## Lo que decidió Alan
1. ✅ **¿Quién prende los módulos?** **Decidido por Alan (2026-11-03): los dos.**
   - El dueño, desde Configuración → Módulos.
   - Nosotros, desde la Consola (en la ficha de cada empresa), para la incorporación del piloto. Usa el mismo campo `modulos` y queda en la bitácora de auditoría quién cambió qué.
2. ✅ **¿Se suma la pantalla al registro?** **Decidido por Alan (2026-11-03): sí.** Después de elegir el rubro aparece "Esto es lo que vas a usar", con los módulos sugeridos y la opción de cambiarlos (paso 5 de "Qué archivos tocar").
3. ✅ **¿Se cobra por módulo o se siguen los 3 planes?** **Decidido por Alan (2026-11-03): se siguen los 3 planes.** Lo que el plan no incluye aparece con candado y "Disponible en Pro". No se cobra por módulo.

## Hecho por el hermano
- Fecha:
- Commit:
- Qué cambió respecto del plan:
