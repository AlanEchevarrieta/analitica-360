# Tienda (storefront multi-negocio)

Tienda online de los negocios de Analítica 360. Una sola app sirve a todas las
empresas: resuelve cuál mostrar por la dirección con la que se entra y lee
nombre, color, logo, contacto, catálogo y datos de transferencia desde la API
pública (`apps/api`, módulos `tienda` y `tienda-sitio`). Los pedidos llegan a
Pedidos de la empresa con origen `tienda_online`. No usa Supabase.

## Cómo elige el negocio

| Dirección | Ejemplo |
| --- | --- |
| Subdominio de la plataforma | `acacia.analitica360.app` |
| Dominio propio del negocio | `acaciamates.com.ar` |
| Desarrollo local | `acacia.localhost:3010` |

Si la dirección no corresponde a una tienda activa se muestra
"Esta tienda no está disponible". Cada negocio configura su tienda en
Analítica 360 → Configuración → Tienda online, y las fotos en la ficha de cada
producto.

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `ANALITICA_API_URL` | URL base de la API (ej. `http://localhost:3001`). Solo servidor. |
| `TIENDA_HOST_FORZADO` | Opcional. Fuerza el host a resolver (ej. `acacia.localhost`), útil para previsualizar sin subdominios. |
| `ANALITICA_TIENDA_KEY` | Opcional. Clave compartida con la API (`TIENDA_PROXY_KEY`) para el límite de pedidos por cliente. Solo servidor. |

## Desarrollo

```bash
pnpm --filter tienda dev        # http://acacia.localhost:3010
pnpm --filter tienda typecheck
```
