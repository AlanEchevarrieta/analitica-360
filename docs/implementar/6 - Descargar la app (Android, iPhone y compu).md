---
tags: [analitica360, para-implementar, agente, sitio]
estado: para hacer
creado: 2026-11-03
base: main 9384b29 (2026-11-01)
---
# Descargar la app: botones para Android, iPhone y compu
Volver a [[Para implementar]]

> **Para el hermano de Alan y sus agentes de IA.** Pasale el documento entero al agente. Lo armó Claude leyendo `main` (`9384b29`) y la página publicada; Claude no tocó código.

## 0. Instrucciones para el agente
**Objetivo:** que en la página (analitica360.app) y dentro de la app haya un botón **"Descargar la app"** que se adapte al dispositivo:
- **Android:** instala directo con un toque.
- **iPhone y iPad:** muestra los 3 pasos para agregarla al inicio desde Safari.
- **Compu:** instala si el navegador lo permite y, si no, muestra un **código QR** para abrirla en el celular.

**Reglas:**
- Trabajar en la rama `feat/descargar-app` y abrir un Pull Request (no subir directo a `main`).
- Textos en español simple, como el resto del sitio.
- Componentes de menos de 250 líneas.
- Que funcione en el celular (390 px).
- No volver a prender la cache del *service worker* (ver la sección 5).

## 1. Lo que hay hoy (revisado el 2026-11-03)
- **La app ya es instalable (PWA):**
  - `apps/web/public/manifest.json` tiene `display: standalone`, íconos de 192 y 512, y colores;
  - `apps/web/src/app/layout.tsx` tiene `manifest`, `icons.apple` y `appleWebApp` (`capable`, `statusBarStyle`, `title`).
- **No hay ningún botón de descarga,** ni para Android ni para iPhone. Lo que "ya anda" en Android es que **Chrome ofrece solo "Instalar app"** desde su menú, porque está el manifest.
  - Si hay un botón de Android en la compu del hermano que todavía no está en GitHub, usar este documento para completarlo.
- **En iPhone no existe ese aviso automático:** Safari nunca ofrece instalar solo. Hay que explicarle a la persona: Compartir → "Agregar a inicio". Por eso hoy, en la práctica, en iPhone no hay "descarga".
- **El *service worker* está desactivado** desde el 1/11 (commit `9d91f00`): `public/sw.js` se borra solo y `components/providers.tsx` desregistra todos.

## 2. Qué se ve según el dispositivo
Hay que detectarlo en el navegador, con una función pura y probada (sección 4.1).

| Dispositivo | Qué muestra el botón | Qué pasa al tocarlo |
|---|---|---|
| **Android** (Chrome, Edge o Samsung Internet) con el evento `beforeinstallprompt` disponible | "📲 Instalar en tu Android" | Abre el aviso nativo de instalación (`evento.prompt()`). Si acepta: "¡Listo! Ya la tenés en tu pantalla de inicio" |
| **Android sin el evento** (Firefox, o el navegador no lo ofreció) | "📲 Instalar en tu Android" | Muestra los pasos: menú **⋮** → **"Instalar app"** o **"Agregar a pantalla de inicio"** |
| **iPhone o iPad en Safari** | " Agregar a tu iPhone" | Abre una hoja con 3 pasos e íconos: 1) tocá **Compartir** (el cuadrado con la flecha ↑), 2) **"Agregar a inicio"**, 3) **"Agregar"** |
| **iPhone o iPad en Chrome o Edge** (iOS 16.4 o más nuevo) | " Agregar a tu iPhone" | Los mismos pasos, con el botón Compartir **arriba a la derecha**, en la barra de direcciones |
| **iPhone o Android dentro de Instagram, Facebook, WhatsApp o TikTok** (navegador interno) | "Abrí esta página en Safari / Chrome para instalarla" | Botón **"Copiar link"** y una explicación: tocá **⋯** → "Abrir en el navegador". **Es clave: la mayoría de las visitas vienen de Instagram** |
| **Compu** (Chrome o Edge) con el evento | "💻 Instalar en la compu" | Aviso nativo de instalación |
| **Compu** (Safari en Mac) | "💻 Agregar al Dock" | Pasos: Archivo → **"Agregar al Dock"** |
| **Compu** (Firefox u otro sin instalación) | "📱 Usala en tu celular" | Un **código QR** a `https://analitica360.app/?descargar=1` |
| **Ya instalada** (`display-mode: standalone`, o `navigator.standalone` en iOS) | No se muestra nada | — |

**Siempre se pueden ver los tres:** debajo del botón principal, el enlace "¿Otro dispositivo?" despliega las tres opciones (Android, iPhone y compu), así alguien que mira desde la compu puede ver los pasos de su iPhone.

## 3. Dónde van los botones
1. **Sitio (la landing), `apps/web/src/features/sitio/components/Sitio.tsx`:**
   - **Sección nueva "Llevala en tu celular"** (`id="app"`), después de la sección de funciones (`id="funciones"`, línea ~119) y antes de los planes:
     - título: "Llevala en tu celular";
     - texto: "Instalala gratis en Android, iPhone o tu compu. No ocupa lugar y se actualiza sola.";
     - el botón inteligente;
     - a la derecha, `MaquetaVentaCelular`, que ya existe en `Maquetas.tsx`.
   - **Encabezado (`Encabezado.tsx`):** un ícono **📲 "App"** que lleva a `#app`. En el celular va dentro del menú.
   - **Pie de página:** "Descargar la app" (al lado de los links legales).
   - Si la página se abre con `?descargar=1` (el link del QR), bajar sola hasta `#app`.
2. **Dentro de la app (usuarios ya registrados):**
   - en `apps/web/src/components/shared/app-sidebar.tsx`, grupo "Cuenta", un ítem **"Instalar la app"** que abre el mismo diálogo. Solo si no está instalada;
   - **un aviso chico, una sola vez,** en Inicio y en el celular: "¿La agregás a tu pantalla de inicio? Abre más rápido". Con los botones "Ver cómo" y "Ahora no". Se guarda en `localStorage` que ya se mostró, para no insistir.
3. **Los textos van en `apps/web/src/features/sitio/contenido.ts`,** igual que el resto del sitio (constante `APP_DESCARGA`).

## 4. Archivos y código
### 4.1 Detección: `apps/web/src/lib/dispositivo.ts` (función pura)
```ts
export type Plataforma = "android" | "ios" | "mac" | "compu";
export type Navegador = "safari" | "chrome" | "edge" | "samsung" | "firefox" | "interno" | "otro";
export interface Dispositivo { plataforma: Plataforma; navegador: Navegador; instalada: boolean }

/** ua = navigator.userAgent; maxTouchPoints = navigator.maxTouchPoints; standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone */
export function detectarDispositivo(ua: string, maxTouchPoints: number, standalone: boolean): Dispositivo;
```
**Reglas:**
- **iPad con iPadOS** se presenta como Mac: si el UA dice `Macintosh` y `maxTouchPoints > 1`, es `ios`.
- **Navegador interno:** el UA contiene `Instagram`, `FBAN`, `FBAV`, `WhatsApp`, `TikTok`, `musical_ly`, `Line/` o `; wv)` (webview de Android).
- **En iOS,** `CriOS` es Chrome, `EdgiOS` es Edge y `FxiOS` es Firefox. Si no es ninguno y dice `Safari`, es Safari.
- **En Android,** `SamsungBrowser` es Samsung, `EdgA` es Edge, `Firefox` es Firefox, y `Chrome` sin `wv` es Chrome.

### 4.2 Hook: `apps/web/src/hooks/use-instalar-app.ts`
- Escucha `beforeinstallprompt`: hace `preventDefault()` y guarda el evento en un estado.
- Escucha `appinstalled`: marca la app como instalada y muestra "¡Listo!".
- Devuelve `{ dispositivo, puedeInstalarDirecto, instalar(): Promise<"aceptada" | "rechazada" | "sin_evento"> }`.
- **El evento puede llegar después de que carga la página:** el botón tiene que reaccionar cuando llega.

### 4.3 Componentes en `apps/web/src/features/descargar-app/`
- **`BotonDescargarApp.tsx`:** el botón inteligente de la tabla de la sección 2, más el link "¿Otro dispositivo?".
- **`PasosInstalacion.tsx`:** un `Dialog`, que en el celular se ve como hoja de abajo, con los pasos de cada plataforma.
  - Cada paso lleva un **dibujito del ícono que hay que tocar**: el de Compartir de iOS, ⋮ y ⊕. Están en `lucide-react`: `Share`, `EllipsisVertical` y `SquarePlus`.
  - Si se puede, **una flecha animada** que señala dónde está el botón Compartir en Safari: abajo en iPhone y arriba en iPad.
- **`QrDescarga.tsx`:** el QR de `https://analitica360.app/?descargar=1`.
  - Generarlo con la librería `qrcode` (`toDataURL`) o como un SVG estático en `public/qr-app.svg`.
  - Nada de servicios externos de QR.
- **`AvisoInstalar.tsx`:** el aviso de una sola vez dentro de la app.

### 4.4 Medir
Ponerles `data-rastreo` a los botones, como pide `Funcionalidades → Uso de la app`. Por ejemplo:
- `data-rastreo="Descargar app: Android"`;
- `"Descargar app: iPhone"`;
- `"Descargar app: QR"`;
- `"Descargar app: copiar link"`.
Así en Consola → Uso se ve cuánta gente la instala y desde dónde.

## 5. Íconos e instalación
- **iPhone (`apple-touch-icon`):**
  - agregar `public/apple-touch-icon.png` de **180×180**, **sin transparencia** (iOS rellena lo transparente con negro), con el logo sobre el color de fondo de la marca;
  - en `layout.tsx`, en `icons.apple`, ponerlo **primero**: `{ url: "/apple-touch-icon.png", sizes: "180x180" }`.
- **Manifest:**
  - verificar que haya un ícono `maskable` de **512** (hoy el maskable es el de 192);
  - sumar `"screenshots"` (una captura de celular de 1080×1920, `form_factor: "narrow"`, y una de compu, `"wide"`): Chrome y Android muestran una ficha de instalación más linda;
  - sumar `"shortcuts"` a "Nueva venta" (`/ventas/nueva`) e "Inicio".
- **Service worker:** hoy está apagado a propósito, porque daba problemas al navegar.
  - **Probar en un Android real** que Chrome siga ofreciendo "Instalar app" y que dispare `beforeinstallprompt`.
  - Si no lo hace, registrar un *service worker* mínimo **sin cache**: con un `fetch` que no intercepta nada, solo para que sea instalable. **No volver a la cache vieja.**

## 6. ¿Y las tiendas (App Store y Google Play)?
**No hace falta para esto.** La PWA se instala sin tiendas, es gratis y se actualiza sola. Para más adelante, si se quiere:

| | Google Play | App Store (iPhone) |
|---|---|---|
| Cuenta de desarrollador | US$25, una sola vez | US$99 por año |
| Cómo | "Envolver" la PWA como TWA (Bubblewrap o PWABuilder) | Envolverla con Capacitor |
| Riesgo | Bajo | **Alto:** Apple suele rechazar apps que son solo una página web (regla 4.2, "funcionalidad mínima"). Hay que sumar algo nativo, como avisos o la cámara |

Recomendación: **primero la PWA con estos botones;** las tiendas, solo si los clientes las piden.

## 7. Pruebas
- **Unitarias (`apps/web`; si no hay Vitest todavía, agregarlo solo para `lib/`):** `detectarDispositivo` con UA reales de:
  - iPhone Safari, iPhone Chrome (`CriOS`), iPad iPadOS (Macintosh + touch);
  - Android Chrome, Samsung Internet, webview de Instagram en Android y en iPhone, WhatsApp;
  - Mac Safari, Windows Chrome y Firefox;
  - y el modo `standalone`.
- **A mano, en dispositivos reales (obligatorio):**
  - [ ] Android con Chrome: el botón instala con un toque y aparece el ícono en el inicio.
  - [ ] Android con Samsung Internet: instala o muestra los pasos.
  - [ ] iPhone con Safari: muestran bien los 3 pasos; al seguirlos queda el ícono (no un cuadrado negro) y abre a pantalla completa.
  - [ ] iPhone desde Instagram: aparece "Abrí en Safari" y anda "Copiar link".
  - [ ] Compu con Chrome: instala. Con Firefox: aparece el QR, se escanea con el celular y lleva a la sección `#app`.
  - [ ] Ya instalada: no aparece el botón.
  - [ ] Modo claro y oscuro, a 390 px y en compu.
- **Comandos:** `pnpm --filter web lint && pnpm --filter web typecheck`.

## 8. Terminado cuando…
- [ ] Botón inteligente en la landing (sección `#app`, encabezado y pie) y en la app (menú y aviso de una sola vez).
- [ ] Detección probada para Android, iPhone y iPad, navegadores internos, compu e instalada.
- [ ] Pasos con dibujos para iPhone y Android, y QR para la compu.
- [ ] `apple-touch-icon` de 180×180, maskable de 512, capturas y accesos directos en el manifest.
- [ ] Probado en un Android y un iPhone reales.
- [ ] `data-rastreo` en los botones.
- [ ] Pull Request con capturas de cada caso.

## Hecho por el hermano
- Fecha:
- Pull Request / commit:
- Qué cambió respecto del plan:
