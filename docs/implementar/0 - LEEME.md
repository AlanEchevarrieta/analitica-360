# Para implementar: Analítica 360 (2026-11-03)

Documentos armados por Claude leyendo `main` (`9384b29`). **Claude no tocó el código:** lo programás vos (o tus agentes).

**Cómo usarlos con un agente de IA:** pasale el archivo `.md` entero como instrucción y pedile que lo siga paso a paso, en una rama nueva y con un Pull Request (no directo a `main`).

## ⚠️ Antes de empezar
`main` se reescribió de forma forzada el 2/11 y se perdieron cosas del 19 y 20/10 (configuración agrupada, tendencia por producto, `cargar-resend.ps1`, subagentes y agente de los lunes). Están a salvo en la rama `feat/alianzas-cupones` (`25b5eda`). Decidí si las traés con un PR.

## 💸 Costo cero
Alan no tiene plata para pagar nada nuevo. Usá solo planes gratis. Si algo pide tarjeta o pasa del plan gratis, frená y avisá.

## Orden sugerido
| # | Archivo | Qué es | Urgencia |
|---|---|---|---|
| 1 | `1 - Gastos recurrentes (auditoría 2026-11-03).md` | Error en Contabilidad: anular un gasto recurrente lo borra de los meses pasados y no se puede editar (quedan duplicados) | 🔴 Da números mal hoy |
| 1b | `1b - Robustez y seguridad antes del piloto.md` | Vulnerabilidades, proteger main, Sentry, copias en R2, Clerk de producción, Copilot sin datos personales. **Cada punto tiene un "Paso 0: verificar": si ya lo hiciste, se saltea** | 🔴 Segundo |
| 1c | `1c - Automatizaciones - Etapa 1 (eventos y reintentos).md` | Cola con reintentos en Postgres: que no se pierdan emails ni informes. Va junto con el 1b | 🔴 Tercero |
| 1d | `1d - Rendimiento (2026-11-03).md` | Cache de los archivos de la web (nginx o Cloudflare), Postgres ajustado, productos lento y menos pedidos por pantalla. Todo gratis | 🔴 El punto A es rápido |
| 2 | `2 - Pronóstico con banda de rango.md` | Volver al gráfico original del pronóstico y sumarle la franja del rango probable | 🟡 |
| 3 | `3 - Tarjetas de 2 por fila en el celular.md` | Las tarjetas de números de a 2 en el celular | 🟡 Rápido |
| 4 | `4 - Módulos que se prenden y apagan.md` | Tu idea de módulos estilo Odoo, con todo decidido por Alan | 🟡 |
| 5 | `5 - Proyectos - Fase 1.md` | Módulo de proyectos para agencias y servicios (escrito para agentes) | ⚪ Grande |
| 6 | `6 - Descargar la app (Android, iPhone y compu).md` | Botones de descarga según el dispositivo (Android, iPhone y compu con QR) | 🟡 Rápido |
| — | `Extra - Mejoras y buenas prácticas.md` | Ideas para robustez y seguridad. Claude recomienda hacer del 1 al 6 antes del piloto (Alan todavía no eligió) | Para leer |

Cuando termines cada uno, completá la sección **"Hecho por el hermano"** al final (fecha, Pull Request y qué cambió), así Claude lo anota en el cerebro.
