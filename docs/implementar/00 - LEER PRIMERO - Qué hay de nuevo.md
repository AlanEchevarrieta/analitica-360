# 📌 LEER PRIMERO: qué hay de nuevo y cómo no repetir trabajo
**Actualizado el 2026-11-03** · Claude revisó GitHub ese día: el último commit en `main` es `9384b29` (1/11). **No había nada nuevo subido**, así que lo que hayas avanzado después está solo en tu compu.

## 1. Qué cambió desde el primer zip
| Archivo | Qué pasó |
|---|---|
| `0 - LEEME.md` | **Cambió:** suma el aviso de `main` reescrito y la regla de **costo cero** |
| `1b - Robustez y seguridad antes del piloto.md` | **Nuevo** (y actualizado con la auditoría del 2/11) |
| `1c - Automatizaciones - Etapa 1 (eventos y reintentos).md` | **Nuevo** |
| `6 - Descargar la app (Android, iPhone y compu).md` | **Nuevo** |
| `1d - Rendimiento (2026-11-03).md` | **Nuevo:** los archivos de la web se descargan de cero en cada visita. El punto A es rápido (nginx o Cloudflare) |
| `2 - Pronóstico con banda de rango.md` | **Cambió poco:** una nota de que la tarjeta ya tiene tus etiquetas nuevas |
| `5 - Proyectos - Fase 1.md` | **Cambió poco:** la opción va en Configuración → "Mi negocio" (los grupos que hay hoy en `main`) |
| `1`, `3`, `4` y `Extra` | Sin cambios |

## 2. Antes de programar: auditar lo que ya está
Si ya hiciste parte de algún documento, **no lo rehagas.** Cada documento tiene al final una lista **"Terminado cuando…"** y, los nuevos, un **"Paso 0: verificar"** en cada punto.

**Pasale esto a tu agente antes de empezar** (copiar y pegar):

> Antes de programar nada, hacé una auditoría. Para cada archivo `.md` de esta carpeta (menos el 0 y el 00):
> 1. Leé su sección "Terminado cuando…" (y los "Paso 0: verificar", si los tiene).
> 2. Revisá **mi copia local del repo** (no solo GitHub; puede haber cambios sin subir): rama actual, `git status`, `git log --all --since=2026-11-01` y el código.
> 3. Marcá cada ítem como ✅ ya está, 🟡 está a medias (decí qué falta) o ❌ falta.
> 4. Devolveme una tabla por documento con esas marcas y **no cambies código todavía.**
>
> Después, con mi OK, implementá **solo lo que esté en ❌ o 🟡**, en el orden del `0 - LEEME.md`: un documento por vez, cada uno en su rama y con su Pull Request. Respetá la regla de costo cero: si algo pide pagar, frená y avisame.

## 3. Cuando termines cada documento
- Completá **"Hecho por el hermano"** al final del archivo (fecha, PR y qué cambió respecto del plan).
- **Subilo a GitHub**, aunque sea en una rama, y avisale a Alan. Así Claude lo revisa leyendo y lo anota en el cerebro.