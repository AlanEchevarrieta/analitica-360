---
tags: [analitica360, propuesta, roadmap]
creado: 2026-11-03
---
# Mejoras y buenas prácticas
Volver a [[00 Inicio]] · [[Roadmap]] · [[Para implementar]]

Ideas para que Analítica 360 sea **robusto, seguro, escalable, eficiente e innovador**, tomadas de cómo trabajan otras empresas. Cada una dice qué es, de quién se copia, por qué nos sirve y quién la hace. Están ordenadas por prioridad: **primero lo que evita perder datos o clientes**.

> Revisado sobre `main` de GitHub (`9384b29`) el 2026-11-03. Claude no tocó código.

## 🔴 Antes del piloto UCIM (lo que más protege)

### 1. Nadie sube directo a `main`: rama, revisión y pruebas automáticas
- **De quién:** GitHub Flow, como trabajan casi todos los equipos (GitHub, Shopify, Mercado Libre).
- **Hoy:**
  - Las pruebas automáticas (`.github/workflows/ci.yml`) ya existen: lint, tipos, pruebas y build.
  - Pero se sube directo a `main`, así que corren cuando el cambio ya está adentro.
  - El 30/10 hubo que unir 37 commits con 7. Ese es el "vamos a romper todo".
- **Propuesta:**
  - cada cambio va en su rama y se pide un *Pull Request*;
  - en GitHub, **proteger `main`**: no se puede subir si las pruebas no pasan;
  - **Claude revisa cada Pull Request** y deja comentarios, sin tocar el código (encaja con [[Cómo trabajamos#Reglas]]).
- **Quién:** hermano (5 minutos de configuración en GitHub).

### 2. Enterarse de los errores antes que el cliente
- **De quién:** Sentry, el estándar para avisos de errores, y Better Stack o UptimeRobot para saber si la app está caída.
- **Hoy:** si la app falla en el celular de un cliente, nadie se entera. El hermano sumó una pantalla amigable de error (1/11): es el primer paso.
- **Propuesta:**
  - **Sentry** en la API y la web (tiene plan gratis): cada error llega con en qué pantalla pasó y qué hizo el usuario;
  - **aviso por email o WhatsApp** si analitica360.app o la API dejan de responder;
  - **una página de estado** para los clientes.
- **Quién:** hermano.

### 3. Copias de seguridad reales fuera del servidor y las fotos en la nube
- **De quién:** la regla 3-2-1 de backups (3 copias, 2 lugares, 1 fuera).
- **Hoy:**
  - El simulacro de restauración de la auditoría da 🟢, pero en la compu.
  - En producción falta el bucket de R2 (en [[Pendientes]]).
  - Las fotos de los productos se guardan en el disco del servidor: si el servidor se rompe, se pierden.
- **Propuesta:**
  - R2 con copia diaria de la base y de las fotos;
  - un simulacro de restauración **en producción** una vez por mes.
- **Quién:** hermano.

### 4. Clerk de producción con doble factor
- **Hoy:** la app publicada usa la clave **de prueba** de Clerk (visto el 30/10).
- **Propuesta:**
  - la instancia de producción (paso a paso en la [[Guía de puesta en producción]]);
  - **doble factor obligatorio** para dueños y administradores (lo piden SOC 2 y la auditoría).
- **Quién:** hermano.

### 5. Copilot IA: que los datos de los clientes no se vayan de más
- **De quién:** Notion AI, Shopify Sidekick e Intuit Assist. Mandan al modelo solo lo mínimo, con proveedores que no guardan ni entrenan con los datos, y lo avisan en la política de privacidad.
- **Hoy:** el Copilot manda el "Dossier 360" del negocio (ventas, gastos, cuenta corriente) a OpenRouter. No figura en la política ni en el [[Registro de actividades de tratamiento]].
- **Propuesta:**
  - mandar totales y no datos de personas (sin nombres, teléfonos ni emails de clientes);
  - elegir un proveedor con **retención cero** de los datos;
  - un límite de preguntas por día por empresa (el costo y los abusos);
  - pruebas de que una empresa nunca recibe datos de otra, ni si se lo pide al chat;
  - sumarlo a la política de privacidad, que va a la v1.3.
- **Quién:** hermano (código) · Alan (aprobar la política) · Claude (borrador de la política y de las pruebas).

### 6. Las librerías se actualizan solas
- **De quién:** Dependabot o Renovate, que usa casi todo GitHub.
- **Hoy:** la auditoría del 26/10 encontró 4 vulnerabilidades críticas en Next y otras librerías, que se arreglan con solo actualizar.
- **Propuesta:** Dependabot abre un Pull Request por cada actualización de seguridad. Con el punto 1, las pruebas dicen si se puede aceptar sin miedo.
- **Quién:** hermano (un archivo `.github/dependabot.yml`).

## 🟡 Durante el piloto (robustez y eficiencia)

### 7. Trabajos en segundo plano con reintentos
- **De quién:** las colas de tareas (BullMQ, Sidekiq) que usan Shopify o Tiendanube para emails, sincronizaciones y webhooks.
- **Hoy:** los informes que no salieron porque faltaba Resend quedaron como `sin_servicio` y **no se reintentan nunca** (5, 12 y 19/10).
- **Propuesta:**
  - una cola con reintentos para emails, informes, sincronización con Mercado Libre, webhooks de Mercado Pago y Factura C (ARCA a veces no responde);
  - un tablero en la Consola con lo que falló.
- **Quién:** hermano · Claude arma el documento.

### 8. Prender funciones de a poco (*feature flags*)
- **De quién:** Facebook, Mercado Libre y LaunchDarkly. Una función nueva se prende primero para 1 o 2 clientes, se mira y después para todos.
- **Por qué:** va de la mano con [[Módulos que se prenden y apagan]]. El mismo interruptor sirve para probar Caja o el Copilot solo con Acacia antes de abrirlos al piloto.
- **Quién:** hermano.

### 9. Ventas sin internet en el stand y en ferias
- **De quién:** Square y Mercado Pago Point, que siguen cobrando sin señal y sincronizan después.
- **Por qué:** Acacia vende en un stand y va a ir a la feria de Bariloche. Si se corta internet, hoy no puede cargar ventas. Para un comercio chico es un diferencial fuerte frente a la competencia.
- **Propuesta:**
  - la pantalla de venta funciona sin conexión: guarda las ventas en el celular y las sube al volver la señal, sin duplicarlas;
  - empezar solo por ventas, que es lo más simple.
- **Ojo:** el hermano desactivó el *service worker* el 1/11 porque daba problemas. Esto se hace con cuidado y con pruebas.
- **Quién:** hermano · Claude arma el documento.

### 10. Escribirle al cliente por WhatsApp
- **De quién:** Tiendanube y Mercado Pago (links de pago), y los bots de turnos.
- **Hoy:** ya hay botones de "Avisar por WhatsApp", que abren WhatsApp a mano.
- **Propuesta:** la API oficial de WhatsApp Business para mandar solo:
  - el comprobante;
  - el recordatorio de turno;
  - el link de pago de una cuota vencida;
  - el resumen semanal (más leído que el email).
- **Ojo:** tiene costo por mensaje. Usarlo solo en los planes que lo paguen.
- **Quién:** Alan (cuenta de Meta) · hermano.

### 11. Importar planillas fácil
- **De quién:** Shopify y Tiendanube, que importan productos y clientes desde Excel con una vista previa.
- **Por qué:** en el piloto la incorporación la hacemos nosotros (D4). Un importador con vista previa ("estas 3 filas tienen el precio vacío") ahorra horas por cliente.
- **Quién:** hermano.

## ⚪ Cuando crezca (escalable)

### 12. Segunda capa de aislamiento entre empresas en la base
- **De quién:** Supabase, Citus y la mayoría de los SaaS multiempresa, con *Row Level Security* (RLS) de Postgres.
- **Hoy:** cada consulta filtra por empresa en el código, y hay pruebas de eso. Pero un solo olvido en una consulta nueva mostraría datos de otro comercio.
- **Propuesta:** que Postgres además rechace cualquier fila de otra empresa, aunque el código se equivoque.
- **Quién:** hermano · Claude arma el documento.

### 13. Base preparada para más clientes
- **Hoy:** un solo servidor de 4 GB y Postgres con la configuración que viene por defecto. La prueba de 400 clientes quedó pausada en [[Pendientes]].
- **Propuesta, en orden y solo cuando haga falta:**
  1. ajustar Postgres;
  2. un administrador de conexiones (PgBouncer);
  3. cache compartido (Redis);
  4. una copia de la base solo para reportes y Analytics.
- **Quién:** hermano.

### 14. Saber qué pasa adentro (observabilidad)
- **De quién:** OpenTelemetry y Grafana, estándar en la industria.
- **Propuesta:** medir cuánto tarda cada pantalla y cada consulta, con alertas si algo se pone lento. Sirve para saber qué optimizar antes de que un cliente se queje.

## 💡 Innovación (lo que nos diferencia)
- **Alertas que se adelantan:** del estilo de los "insights" de Shopify. Por ejemplo:
  - "Este mes vendés 20 % menos que el anterior";
  - "Te quedan 3 días de stock de Mates imperial";
  - "Te vas a pasar del tope del monotributo en marzo".
  Ya están los cálculos (Insights, Objetivos, monotributo); falta mandarlos solos.
- **Portal del contador:** como Xubio y Alegra. El contador entra a todas las empresas que atiende, con un solo usuario, y baja todo en el formato que usa. El rol `org:contador` ya está previsto; los contadores pueden ser un canal de venta.
- **Conciliación automática con Mercado Pago:** como Xubio y Colppy. Traer los movimientos de la cuenta y cruzarlos solos con las ventas y los gastos.
- **"Novedades" dentro de la app y encuesta de satisfacción:** como Intercom y Linear. Cada mejora se anuncia adentro, y cada tanto se pregunta "¿Nos recomendarías?" del 0 al 10. Es clave para el piloto.
- **Página de seguridad para vender:** como el "Trust Center" de Vanta y Stripe. Una página que diga cómo cuidamos los datos: backups, cifrado, auditoría semanal y Ley 25.326. Las auditorías que ya hacemos son un argumento de venta.

## Cómo seguimos
1. **Alan elige** cuáles van y en qué orden. La recomendación de Claude: **del 1 al 6 antes del piloto**.
2. Claude arma un documento en [[Para implementar]] para cada una elegida.
3. El hermano las programa.
