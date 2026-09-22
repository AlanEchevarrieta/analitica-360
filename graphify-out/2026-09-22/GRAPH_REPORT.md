# Graph Report - analitica-360  (2026-09-22)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2726 nodes · 7026 edges · 211 communities (123 shown, 88 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 60 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `791ad91e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- PedidoFichaPage.tsx
- importarVentas.ts
- App.tsx
- difusiones.ts
- RegistroPage.tsx
- react
- tickets.ts
- AnalyticsPage.tsx
- insights.ts
- ContabilidadPage.tsx
- AdminPage.tsx
- analytics.ts
- HomePage.tsx
- codigoBarras.ts
- ConfiguracionPage.tsx
- permisos.ts
- requireSupabase
- DevolucionNuevaPage.tsx
- planes.ts
- ventas.ts
- variantes.ts
- 08-integridad.spec.ts
- ConfiguracionPage
- VentaNuevaPage.tsx
- @nestjs/common
- InsightsPage.tsx
- inflacion.ts
- api/package.json
- usuarios.module.ts
- ProductoFormPage.tsx
- app.module.ts
- package.json
- InflacionVsPreciosPanel.tsx
- auditoria.ts
- ProveedorFormPage.tsx
- ClienteFichaPage.tsx
- notificaciones.ts
- usuarios.service.ts
- OcrFacturaPanel.tsx
- 039_tickets_soporte.sql
- PedidoNuevaPage.tsx
- InventarioPage.tsx
- compilerOptions
- dependencies
- lotes.ts
- compilerOptions
- rol.types.ts
- compilerOptions
- devDependencies
- scripts
- ParticleNetwork
- consulta.ts
- 035_variantes.sql
- public.analytics_contar_ventas
- compilerOptions
- devDependencies
- web/package.json
- 017_clientes.sql
- scripts
- layout.tsx
- public.lotes
- shared-types/package.json
- 006_productos.sql
- tasks
- request-context.types.ts
- 007_ventas.sql
- 016_compras.sql
- 052_pedidos.sql
- 058_bugs_auditoria.sql
- 059_ordenes_compra.sql
- manifest.json
- main.tsx
- EscanerCodigoBarras.tsx
- LandingPage.tsx
- exportarDatos.ts
- public.ajustar_stock
- dependencies
- @clerk/nextjs
- usuarios
- 034_venta_total_con_interes.sql
- 060_invitaciones_flujo.sql
- public.devoluciones
- devDependencies
- 025_admin_saas.sql
- 037_numero_venta_anular_compras_categorias.sql
- public.confirmar_venta
- 054_equipo_roles.sql
- 003_asignar_y_trial_en_alta.sql
- 022_proveedores.sql
- 032_inventario_movimientos.sql
- 056_permisos_granulares.sql
- 068_senias.sql
- oxlint.json
- tsconfig.build.json
- public.analytics_periodo
- public.anulaciones
- public.confirmar_venta
- public.listar_productos_con_stock
- public.confirmar_venta
- nest-cli.json
- dependencies
- .oxlintrc.json
- public.admin_saas_metrics
- crearCliente
- public.dashboard_inicio
- public.dashboard_inicio
- public.analytics_periodo
- 033_indices_inventario.sql
- public.gastos
- 070_rol_contador.sql
- scripts
- public.contar_notificaciones
- SetupPage.tsx
- 008_cuotas_y_precio_actual.sql
- public.importar_venta
- public.insights_combos
- public.insights_combos_3
- public.analytics_periodo
- emails.ts
- public.mi_suscripcion_activa
- 009_configuracion_empresa.sql
- public.importar_venta
- public.confirmar_compra
- 057_listar_equipo.sql
- public.anular_venta
- public.segmentos_clientes
- public.difusiones
- vercel.json
- vite-build.mjs
- invitar-usuario/index.ts
- vite-env.d.ts
- public.analytics_periodo
- public.aplicar_costos_compra
- public.aplicar_costos_compra
- tsconfig.json
- postcss.config.mjs
- jsbarcode.d.ts
- ocr-factura/index.ts
- Controller
- Module
- public.atributos
- public.movimientos_inventario
- public.productos
- public.ventas
- public.usuarios
- public.empresas
- public.configuracion_empresa
- public.compras
- public.proveedores
- public.empresas
- public.empresas
- public.configuracion_empresa
- public.compras_items
- public.productos
- public.productos
- public.ventas
- public.compras_items
- public.configuracion_empresa
- public.ventas_items
- public.configuracion_empresa
- public.configuracion_empresa
- public.pedidos
- public.pedidos
- public.configuracion_empresa
- public.invitaciones_colaboradores
- public.compras
- public.configuracion_empresa
- public.compras
- public.compras
- public.invitaciones_colaboradores
- public.compras

## God Nodes (most connected - your core abstractions)
1. `requireSupabase()` - 169 edges
2. `useAuth()` - 90 edges
3. `formatoARS()` - 81 edges
4. `react` - 75 edges
5. `ConfiguracionPage()` - 66 edges
6. `AnalyticsPage()` - 52 edges
7. `react-router-dom` - 49 edges
8. `ParticleNetwork()` - 48 edges
9. `AppNav()` - 44 edges
10. `obtenerConfiguracion()` - 42 edges

## Surprising Connections (you probably didn't know these)
- `VentaFichaPage()` --indirect_call--> `fechaHoyAR()`  [INFERRED]
  src/pages/VentaFichaPage.tsx → src/lib/analytics.ts
- `Grafico7Dias` --indirect_call--> `TooltipBarras7Dias()`  [INFERRED]
  src/pages/HomePage.tsx → src/components/CustomTooltip.tsx
- `GraficoTop5` --indirect_call--> `TooltipTopProductos()`  [INFERRED]
  src/pages/HomePage.tsx → src/components/CustomTooltip.tsx
- `VentasVsComprasChart` --indirect_call--> `TooltipVentasCompras()`  [INFERRED]
  src/pages/AnalyticsPage.tsx → src/components/CustomTooltip.tsx
- `OrdenCompraNuevaPage()` --calls--> `useAuth()`  [EXTRACTED]
  src/pages/OrdenCompraNuevaPage.tsx → src/auth.tsx

## Import Cycles
- None detected.

## Communities (211 total, 88 thin omitted)

### Community 0 - "PedidoFichaPage.tsx"
Cohesion: 0.05
Nodes (91): jspdf, jspdf-autotable, PedidoFichaPage, cargar(), mostrarToast(), actualizarEstadoOc(), armarFicha(), esEstado() (+83 more)

### Community 1 - "importarVentas.ts"
Cohesion: 0.06
Nodes (83): xlsx, ImportarComprasModal(), ImportarExcelModal(), confirmar(), onArchivo(), sep, ImportarOperacionModal(), cargar() (+75 more)

### Community 2 - "App.tsx"
Cohesion: 0.06
Nodes (53): AppRoutes(), ClienteFichaPage, ClienteFormPage, ClientesPage, CompraFichaPage, ComprasPage, DevolucionFichaPage, DevolucionNuevaPage (+45 more)

### Community 3 - "difusiones.ts"
Cohesion: 0.05
Nodes (72): DifusionClientes(), abrirModal(), onChip(), insertarEn(), OPCIONES, truncar(), HistorialMovimientosPanel(), textoReferencia() (+64 more)

### Community 4 - "RegistroPage.tsx"
Cohesion: 0.05
Nodes (53): CompletarAltaPage, LoginPage, PrivacidadPage, RegistroPage, ResetPasswordPage, TerminosPage, AuthProvider(), esRateLimitAuth() (+45 more)

### Community 5 - "react"
Cohesion: 0.14
Nodes (47): react, react-router-dom, BadgeLote(), FiltroEstado, BadgeEstado(), BadgeMargen(), BadgePago(), btnPrimary (+39 more)

### Community 6 - "tickets.ts"
Cohesion: 0.08
Nodes (52): SoporteFichaPage, SoporteNuevoPage, cardShell, BadgeEstadoTicket(), BadgePrioridadTicket(), ESTADO_STYLE, PRIORIDAD_STYLE, TicketHilo() (+44 more)

### Community 7 - "AnalyticsPage.tsx"
Cohesion: 0.07
Nodes (53): AnalyticsPage, CHART_ACTIVE_BAR, CHART_BAR_BG, CHART_CURSOR_FILL, CHART_TOOLTIP_STYLE, ChartTooltipBox(), colorBarraMargen(), colorTextoMargen() (+45 more)

### Community 8 - "insights.ts"
Cohesion: 0.07
Nodes (51): simple-statistics, sumarDiasIso(), agregarPorClave(), armarForecast(), armarVariantes(), bulletsSalud(), calcularElasticidades(), calcularSalud() (+43 more)

### Community 9 - "ContabilidadPage.tsx"
Cohesion: 0.09
Nodes (47): ContabilidadPage, fechaHoyAR(), formatoEjeCompacto(), acumuladoSerie(), calcularValorStock(), cargarContabilidad(), finDeMesClave(), labelMesClave() (+39 more)

### Community 10 - "AdminPage.tsx"
Cohesion: 0.07
Nodes (45): AdminPage, AdminCapacidad, AdminPagoFila, AdminSaasMetrics, asRecord(), CAPACIDAD_CERO, cargarAdminCapacidad(), cargarAdminSaasMetrics() (+37 more)

### Community 11 - "analytics.ts"
Cohesion: 0.09
Nodes (48): agruparEvolucion(), AnalyticsClientes, AnalyticsDiaSemanaRaw, AnalyticsPago, AnalyticsPeriodo, AnalyticsProducto, AnalyticsPunto, AnalyticsTop (+40 more)

### Community 12 - "HomePage.tsx"
Cohesion: 0.07
Nodes (35): HomePage, LimitePlanModal(), CumpleProximo, textoCumpleProximo(), asArray(), asRecord(), cargarDashboardInicio(), cargarSerieVentasHome() (+27 more)

### Community 13 - "codigoBarras.ts"
Cohesion: 0.08
Nodes (41): qrcode, CHECKS, EtiquetaOpcionesModal(), cambiarTamano(), toggle(), TAMANOS, aplicarCamposPorTamano(), calcularEAN13() (+33 more)

### Community 14 - "ConfiguracionPage.tsx"
Cohesion: 0.08
Nodes (42): ConfiguracionPage, CONFIG_DEFAULT, fiscalDesdeFila(), FLUJO_VENTAS_DEFAULT, flujoAJson(), FlujoVentas, guardarAsignacionPedidos(), guardarConfiguracion() (+34 more)

### Community 15 - "permisos.ts"
Cohesion: 0.10
Nodes (33): PermisosChecklist(), AccesoColaborador, accesoContador(), accesoSoloPedidos(), accesoSoloVentas(), accesoTotal(), accesoVacio(), ACCION_IDS (+25 more)

### Community 16 - "requireSupabase"
Cohesion: 0.10
Nodes (36): CompraNuevaPage, AnularCompraModal(), confirmar(), abrirModal(), anularCompra(), CompraFicha, CompraFila, confirmarCompra() (+28 more)

### Community 17 - "DevolucionNuevaPage.tsx"
Cohesion: 0.12
Nodes (31): DevolucionesTab(), buscarVentasDevolucion(), cancelarDevolucion(), DevolucionFicha, DevolucionFila, diferenciaCambio(), EstadoDevolucion, estiloEstadoDevolucion() (+23 more)

### Community 18 - "planes.ts"
Cohesion: 0.11
Nodes (34): PlanesPage, PlanesModal(), UpgradePlanPage(), CATALOGO_PLANES, CatalogoPlan, CatalogoPlanId, CicloFacturacion, claseBadgePlan() (+26 more)

### Community 19 - "ventas.ts"
Cohesion: 0.12
Nodes (33): AnularVentaModal(), confirmar(), exportarVentasExcel(), exportarVentasPdf(), fechaArchivo(), filasExcel(), nombreArchivoAnalytics(), nombreArchivoVentas() (+25 more)

### Community 20 - "variantes.ts"
Cohesion: 0.13
Nodes (33): AjustarStockModal(), confirmar(), CeldaStockActual(), ProductoVariantesEditor, ProductoVariantesHandle, VarianteDraft, ajustarStock(), AnalyticsVariantes (+25 more)

### Community 21 - "08-integridad.spec.ts"
Cohesion: 0.17
Nodes (21): envPath, root, ref_node_fs, ref_node_path, ref_node_url, @playwright/test, credencialesListas(), anularUltimaVenta() (+13 more)

### Community 22 - "ConfiguracionPage"
Cohesion: 0.10
Nodes (27): @supabase/supabase-js, CategoriaFila, eliminarCategoria(), guardarCategoria(), listarCategorias(), mapFila(), msgSql(), sembrarCategoriasDefault() (+19 more)

### Community 23 - "VentaNuevaPage.tsx"
Cohesion: 0.11
Nodes (28): VentaNuevaPage, ConfiguracionEmpresa, etiquetaMedioPago(), idMedioAVenta(), ordenarCuotasParaVenta(), desgloseIva(), registrarTraslado(), registrarTrasladoMasivo() (+20 more)

### Community 24 - "@nestjs/common"
Cohesion: 0.12
Nodes (15): normalizarRol(), IS_PUBLIC_KEY, ROLES_KEY, ClerkAuthGuard, Injectable, EmpresaScopeGuard, Injectable, RolesGuard (+7 more)

### Community 25 - "InsightsPage.tsx"
Cohesion: 0.09
Nodes (22): InsightsPage, GraficoExpandible(), SelectorChips(), limpiarPeriodoAnalytics(), PresetPeriodo, SERIE_INFLACION_VACIA, SerieInflacionPrecios, contarProductosCatalogo() (+14 more)

### Community 26 - "inflacion.ts"
Cohesion: 0.14
Nodes (27): inicioMesIso(), leerPeriodoAnalytics(), acumularPct(), cacheBcra, cargarInflacionVsPrecios(), fechaValidaIso(), fetchBcraTramo(), filasBcra() (+19 more)

### Community 27 - "api/package.json"
Cohesion: 0.08
Nodes (24): author, description, svix, license, name, private, type, version (+16 more)

### Community 28 - "usuarios.module.ts"
Cohesion: 0.12
Nodes (13): RolCrudo, Inject, InMemoryUsuariosRepository, Injectable, Module, UsuariosModule, EmpresaRecord, UpsertEmpresaInput (+5 more)

### Community 29 - "ProductoFormPage.tsx"
Cohesion: 0.14
Nodes (24): jsbarcode, ProductoFormPage, CodigoBarrasPreview(), defPlan(), actualizarProducto(), asignarCategoriaProducto(), crearProducto(), guardarCodigoBarra() (+16 more)

### Community 30 - "app.module.ts"
Cohesion: 0.12
Nodes (15): AppController, Controller, AppModule, Module, AppService, Public(), envSchema, validateEnv() (+7 more)

### Community 31 - "package.json"
Cohesion: 0.09
Nodes (23): engines, node, react, react-dom, name, packageManager, private, type (+15 more)

### Community 32 - "InflacionVsPreciosPanel.tsx"
Cohesion: 0.16
Nodes (22): recharts, ChartResponsive(), intervaloEjeX(), MARGIN_CHART, propsEjeX(), propsEjeY(), tamanoTick(), useAltoGrafico() (+14 more)

### Community 33 - "auditoria.ts"
Cohesion: 0.20
Nodes (24): amarillo(), auditarEmpresa(), bloqCompras(), bloqProductos(), bloqVentas(), bold(), EMPRESAS, enChunks() (+16 more)

### Community 34 - "ProveedorFormPage.tsx"
Cohesion: 0.18
Nodes (22): ProveedorFormPage, actualizarProveedor(), CompraProveedor, CONDICIONES_AFIP, CONDICIONES_PAGO, crearProveedor(), FORMAS_PAGO_ACEPTADAS, formatCbu() (+14 more)

### Community 35 - "ClienteFichaPage.tsx"
Cohesion: 0.17
Nodes (22): actualizarCliente(), agregarInteraccion(), ClienteFicha, ClienteInput, COLOR_ETIQUETA, cumpleanosAFecha(), diasHastaCumple(), EtiquetaCliente (+14 more)

### Community 36 - "notificaciones.ts"
Cohesion: 0.13
Nodes (18): NotificacionesCampana(), armarItemsNotif(), claveSeen(), contarNotificaciones(), ConteosNotif, EVENTO_NOTIF, guardarSeen(), IdNotif (+10 more)

### Community 37 - "usuarios.service.ts"
Cohesion: 0.14
Nodes (15): ClerkKnownWebhookEvent, ClerkOrganizationCreatedEvent, ClerkOrganizationMembershipDeletedEvent, ClerkOrganizationMembershipEvent, ClerkWebhookEvent, Controller, UsuariosController, mapearRolClerk() (+7 more)

### Community 38 - "OcrFacturaPanel.tsx"
Cohesion: 0.18
Nodes (20): Fase, ItemOcrMapeado, OcrFacturaPanel(), aplicar(), armarItems(), elegirArchivo(), payload(), procesar() (+12 more)

### Community 39 - "039_tickets_soporte.sql"
Cohesion: 0.12
Nodes (14): public.asignar_numero_ticket, public.tickets_before_write, public.tickets_respuestas_before_insert, public.tickets, public.tickets_respuestas, public.empresas, public.usuarios, tickets_created_idx (+6 more)

### Community 40 - "PedidoNuevaPage.tsx"
Cohesion: 0.17
Nodes (16): PedidoNuevaPage, listarClientes(), lotesDisponiblesProducto(), armarDireccionEnvio(), esBusquedaCodigoBarras(), listarVariantesActivas(), stockPorVariante(), Linea (+8 more)

### Community 41 - "InventarioPage.tsx"
Cohesion: 0.15
Nodes (18): EstadoStock, etiquetaEstadoStock(), leerUmbralStock(), notasDesdeOc(), tienePermiso(), listarProductosNombres(), listarProductosPaginado(), ProductoConStock (+10 more)

### Community 42 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowSyntheticDefaultImports, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, incremental, isolatedModules (+11 more)

### Community 43 - "dependencies"
Cohesion: 0.10
Nodes (20): dependencies, jsbarcode, jspdf, jspdf-autotable, lucide-react, papaparse, qrcode, react (+12 more)

### Community 44 - "lotes.ts"
Cohesion: 0.17
Nodes (15): InventarioLotesTab(), guardarLote(), esAtributoColor(), HEX_COLOR, hexDeColor(), VarianteChipsPicker(), crearLote(), etiquetaLoteOpcion() (+7 more)

### Community 45 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 46 - "rol.types.ts"
Cohesion: 0.17
Nodes (12): AccionClave, ACCIONES, ACCIONES_CONTADOR, ModuloClave, MODULOS, MODULOS_CONTADOR, tieneAccion(), tieneModulo() (+4 more)

### Community 47 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 48 - "devDependencies"
Cohesion: 0.11
Nodes (18): devDependencies, dotenv, oxlint, @playwright/test, rollup-plugin-visualizer, tailwindcss, @tailwindcss/vite, terser (+10 more)

### Community 49 - "scripts"
Cohesion: 0.11
Nodes (18): scripts, auditoria, auditoria:acacia, auditoria:analitica, build, dev, lint, new:build (+10 more)

### Community 50 - "ParticleNetwork"
Cohesion: 0.22
Nodes (15): createParticles(), leerColores(), Particle, ParticleNetwork(), bindObserver(), draw(), medidas(), onResize() (+7 more)

### Community 51 - "consulta.ts"
Cohesion: 0.18
Nodes (15): TOAST_BG, ToastHost(), AuthLike, avisarSesionExpirada(), esErrorAuth(), esErrorRed(), fetchSupabase(), MSG_SESION_EXPIRADA (+7 more)

### Community 52 - "035_variantes.sql"
Cohesion: 0.16
Nodes (17): idx_atributos_empresa, idx_items_variante, idx_mov_variante, idx_variantes_producto, public.analytics_variantes(), public.atributos, public.confirmar_venta(), public.producto_variantes (+9 more)

### Community 53 - "public.analytics_contar_ventas"
Cohesion: 0.21
Nodes (12): public.analytics_contar_ventas(), public.analytics_evolucion(), public.analytics_top_productos(), public.analytics_variantes(), base, LATERAL, public.producto_variantes, public.productos (+4 more)

### Community 54 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 55 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, @nestjs/cli, @nestjs/mau, @nestjs/schematics, @nestjs/testing, oxlint, prettier, source-map-support (+8 more)

### Community 56 - "web/package.json"
Cohesion: 0.13
Nodes (14): eslintConfig, svix, name, packageManager, private, version, tailwindcss, @types/node (+6 more)

### Community 57 - "017_clientes.sql"
Cohesion: 0.17
Nodes (10): idx_clientes_empresa, idx_clientes_interacciones_cliente, idx_ventas_cliente, public.agregar_interaccion_cliente(), public.clientes, public.clientes_interacciones, public.confirmar_venta(), public.empresas (+2 more)

### Community 58 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, deploy, format, lint, start, start:debug, start:dev (+6 more)

### Community 59 - "layout.tsx"
Cohesion: 0.14
Nodes (7): nextConfig, apps_web_src_app_globals, geistMono, geistSans, metadata, next, ref_svix

### Community 60 - "public.lotes"
Cohesion: 0.21
Nodes (12): idx_lotes_producto, idx_lotes_vencimiento, idx_mov_lote, public.confirmar_compra(), public.lotes, public.clientes, public.empresas, public.movimientos_inventario (+4 more)

### Community 61 - "shared-types/package.json"
Cohesion: 0.15
Nodes (12): dependencies, zod, main, name, private, scripts, build, lint (+4 more)

### Community 62 - "006_productos.sql"
Cohesion: 0.24
Nodes (9): idx_mov_empresa_producto, idx_precios_empresa_producto, idx_productos_empresa, public.movimientos_inventario, public.precios_historial, public.productos, public, public.empresas (+1 more)

### Community 63 - "tasks"
Cohesion: 0.15
Nodes (12): dependsOn, outputs, cache, persistent, dependsOn, $schema, tasks, build (+4 more)

### Community 64 - "request-context.types.ts"
Cohesion: 0.23
Nodes (9): ClerkAuthContext, EmpresaContext, express, Request, UsuarioContext, AccesoColaborador, Rol, CurrentEmpresa (+1 more)

### Community 65 - "007_ventas.sql"
Cohesion: 0.24
Nodes (8): idx_ventas_empresa_fecha, idx_ventas_items_empresa, idx_ventas_items_venta, public.ventas, public.ventas_items, public.empresas, public.productos, public.usuarios

### Community 66 - "016_compras.sql"
Cohesion: 0.23
Nodes (8): idx_compras_empresa, idx_compras_items_compra, public.compras, public.compras_items, public, public.empresas, public.productos, public.usuarios

### Community 67 - "052_pedidos.sql"
Cohesion: 0.20
Nodes (8): public.pedidos, public.pedidos_items, public.pedidos_numeracion, public.clientes, public.empresas, public.lotes, public.producto_variantes, public.productos

### Community 68 - "058_bugs_auditoria.sql"
Cohesion: 0.24
Nodes (11): public.analytics_periodo(), public.listar_productos_con_stock(), public.listar_productos_empresa(), public.listar_ubicaciones_empresa(), public.ventas_match_cliente(), public.movimientos_inventario, public.producto_variantes, public.productos (+3 more)

### Community 69 - "059_ordenes_compra.sql"
Cohesion: 0.20
Nodes (8): public.ordenes_compra, public.ordenes_compra_items, public.ordenes_compra_numeracion, public, public.empresas, public.producto_variantes, public.productos, public.proveedores

### Community 70 - "manifest.json"
Cohesion: 0.18
Nodes (10): background_color, description, display, icons, name, orientation, permissions, short_name (+2 more)

### Community 71 - "main.tsx"
Cohesion: 0.20
Nodes (8): react-dom, @sentry/react, App(), src_index, hashParams, params, initSentry(), SENSITIVE_FIELDS

### Community 72 - "EscanerCodigoBarras.tsx"
Cohesion: 0.27
Nodes (10): @zxing/browser, @zxing/library, conexionSegura(), dispararPedidoCamara(), EscanerCodigoBarras(), reintentar(), esIphone(), Fase (+2 more)

### Community 73 - "LandingPage.tsx"
Cohesion: 0.18
Nodes (6): LandingPage, FEATURES, InstallPwaBlock(), ParticleNetwork, PLANES, RUBROS

### Community 74 - "exportarDatos.ts"
Cohesion: 0.58
Nodes (10): bajarExcel(), exportarDatosClientes(), exportarDatosCompras(), exportarDatosGastos(), exportarDatosInventario(), exportarDatosProductos(), exportarDatosVentas(), fechaArchivo() (+2 more)

### Community 75 - "public.ajustar_stock"
Cohesion: 0.18
Nodes (9): public.ajustar_stock(), public.clientes, public.compras, public.configuracion_empresa, public.movimientos_inventario, public.productos, public.usuarios, public.ventas (+1 more)

### Community 76 - "dependencies"
Cohesion: 0.20
Nodes (10): dependencies, @clerk/backend, @nestjs/common, @nestjs/config, @nestjs/core, @nestjs/platform-express, reflect-metadata, rxjs (+2 more)

### Community 77 - "@clerk/nextjs"
Cohesion: 0.20
Nodes (3): config, isPublicRoute, @clerk/nextjs

### Community 78 - "usuarios"
Cohesion: 0.33
Nodes (9): auth, empresas, historial_planes, idx_usuarios_empresa, public.get_empresa_id(), public.get_rol(), public.registrar_empresa(), auth.users (+1 more)

### Community 79 - "034_venta_total_con_interes.sql"
Cohesion: 0.31
Nodes (8): public.analytics_periodo(), public.confirmar_venta(), public.listar_ventas_empresa(), public.monto_venta(), public.clientes, public.productos, public.ventas, public.ventas_items

### Community 80 - "060_invitaciones_flujo.sql"
Cohesion: 0.24
Nodes (9): public.aceptar_invitacion_colaborador(), public.eliminar_colaborador(), public.email_tiene_cuenta(), public.info_invitacion_empresa(), public.listar_equipo(), auth.users, public.empresas, public.invitaciones_colaboradores (+1 more)

### Community 81 - "public.devoluciones"
Cohesion: 0.22
Nodes (7): public.devoluciones, public.devoluciones_items, public.empresas, public.producto_variantes, public.productos, public.usuarios, public.ventas

### Community 82 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node, @types/react, @types/react-dom (+1 more)

### Community 83 - "025_admin_saas.sql"
Cohesion: 0.31
Nodes (6): idx_pagos_empresa_fecha, public.admin_saas_metrics(), public.pagos, public.empresas, public.planes, public.suscripciones

### Community 84 - "037_numero_venta_anular_compras_categorias.sql"
Cohesion: 0.31
Nodes (6): public.asignar_numero_venta(), public.categorias, public.sembrar_categorias_default(), public.ventas_numeracion, public.compras_items, public.empresas

### Community 85 - "public.confirmar_venta"
Cohesion: 0.31
Nodes (8): public.confirmar_compra(), public.confirmar_venta(), public.clientes, public.lotes, public.producto_variantes, public.productos, public.proveedores, public.ubicaciones

### Community 86 - "054_equipo_roles.sql"
Cohesion: 0.33
Nodes (8): idx_invitaciones_empresa, public.aceptar_invitacion_colaborador(), public.get_rol(), public.invitaciones_colaboradores, public.invitar_colaborador(), auth.users, public.empresas, public.usuarios

### Community 87 - "003_asignar_y_trial_en_alta.sql"
Cohesion: 0.25
Nodes (4): public.registrar_empresa(), auth.users, public.planes, public.usuarios

### Community 88 - "022_proveedores.sql"
Cohesion: 0.32
Nodes (4): idx_proveedores_empresa_nombre, public.confirmar_compra(), public.proveedores, public.empresas

### Community 89 - "032_inventario_movimientos.sql"
Cohesion: 0.32
Nodes (7): idx_mov_tipo_fecha, public.listar_resumen_inventario(), public.registrar_traslado(), public.ubicaciones, public.empresas, public.movimientos_inventario, public.productos

### Community 90 - "056_permisos_granulares.sql"
Cohesion: 0.36
Nodes (7): public.aceptar_invitacion_colaborador(), public.colaborador_permisos, public.guardar_colaborador_permisos(), public.invitar_colaborador(), auth.users, public.empresas, public.usuarios

### Community 91 - "068_senias.sql"
Cohesion: 0.32
Nodes (6): public.analytics_periodo(), public.marcar_senia_venta(), public.monto_venta(), public.productos, public.ventas, public.ventas_items

### Community 92 - "oxlint.json"
Cohesion: 0.29
Nodes (6): env, node, rules, @typescript-eslint/no-explicit-any, @typescript-eslint/no-floating-promises, $schema

### Community 93 - "tsconfig.build.json"
Cohesion: 0.29
Nodes (6): compilerOptions, rootDir, exclude, extends, include, ./tsconfig.json

### Community 94 - "public.analytics_periodo"
Cohesion: 0.38
Nodes (6): idx_ventas_empresa_fecha, idx_ventas_items_empresa_venta, public.analytics_periodo(), public.productos, public.ventas, public.ventas_items

### Community 95 - "public.anulaciones"
Cohesion: 0.29
Nodes (6): public.anulaciones, public.anular_venta(), public.empresas, public.usuarios, public.ventas, public.ventas_items

### Community 96 - "public.confirmar_venta"
Cohesion: 0.38
Nodes (6): public.confirmar_venta(), public.listar_productos_con_stock(), public.clientes, public.movimientos_inventario, public.producto_variantes, public.productos

### Community 97 - "public.listar_productos_con_stock"
Cohesion: 0.38
Nodes (6): idx_productos_codigo_barra, public.listar_productos_con_stock(), public.listar_productos_empresa(), public.movimientos_inventario, public.producto_variantes, public.productos

### Community 98 - "public.confirmar_venta"
Cohesion: 0.29
Nodes (6): public.confirmar_venta(), public.clientes, public.lotes, public.producto_variantes, public.productos, public.ubicaciones

### Community 99 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 100 - "dependencies"
Cohesion: 0.33
Nodes (6): dependencies, @clerk/nextjs, next, react, react-dom, svix

### Community 101 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 102 - "public.admin_saas_metrics"
Cohesion: 0.33
Nodes (5): public.pagos, public.admin_saas_metrics(), public.empresas, public.planes, public.suscripciones

### Community 103 - "crearCliente"
Cohesion: 0.40
Nodes (5): crearCliente(), ClienteFormPage(), onSubmit(), crearClienteInline(), elegirCliente()

### Community 104 - "public.dashboard_inicio"
Cohesion: 0.33
Nodes (5): public.dashboard_inicio(), public.movimientos_inventario, public.productos, public.ventas, public.ventas_items

### Community 105 - "public.dashboard_inicio"
Cohesion: 0.33
Nodes (5): public.dashboard_inicio(), public.movimientos_inventario, public.productos, public.ventas, public.ventas_items

### Community 106 - "public.analytics_periodo"
Cohesion: 0.33
Nodes (5): public.analytics_periodo(), public.clientes, public.productos, public.ventas, public.ventas_items

### Community 107 - "033_indices_inventario.sql"
Cohesion: 0.40
Nodes (5): idx_movimientos_producto, idx_movimientos_tipo, idx_ubicaciones_empresa, public.movimientos_inventario, public.ubicaciones

### Community 108 - "public.gastos"
Cohesion: 0.40
Nodes (5): idx_gastos_empresa_fecha, public.gastos, public, public.empresas, public.usuarios

### Community 109 - "070_rol_contador.sql"
Cohesion: 0.47
Nodes (5): public.aceptar_invitacion_colaborador(), public.get_rol(), public.invitar_contador(), auth.users, public.usuarios

### Community 110 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, start

### Community 111 - "public.contar_notificaciones"
Cohesion: 0.40
Nodes (4): public.tickets, public.contar_notificaciones(), public.lotes, public.pedidos

### Community 114 - "public.importar_venta"
Cohesion: 0.40
Nodes (4): public.importar_venta(), public.clientes, public.producto_variantes, public.productos

### Community 115 - "public.insights_combos"
Cohesion: 0.40
Nodes (4): public.insights_combos(), productos, ventas, ventas_items

### Community 116 - "public.insights_combos_3"
Cohesion: 0.40
Nodes (4): public.insights_combos_3(), productos, ventas, ventas_items

### Community 117 - "public.analytics_periodo"
Cohesion: 0.40
Nodes (4): public.analytics_periodo(), public.productos, public.ventas, public.ventas_items

### Community 120 - "public.mi_suscripcion_activa"
Cohesion: 0.50
Nodes (3): public.mi_suscripcion_activa(), public.planes, public.suscripciones

### Community 122 - "public.importar_venta"
Cohesion: 0.50
Nodes (3): public.importar_venta(), public.clientes, public.productos

### Community 123 - "public.confirmar_compra"
Cohesion: 0.50
Nodes (3): public.confirmar_compra(), public.producto_variantes, public.proveedores

### Community 126 - "public.anular_venta"
Cohesion: 0.50
Nodes (3): public.anular_venta(), public.ventas, public.ventas_items

### Community 127 - "public.segmentos_clientes"
Cohesion: 0.50
Nodes (3): public.segmentos_clientes(), public.clientes, public.ventas

### Community 128 - "public.difusiones"
Cohesion: 0.50
Nodes (3): public.difusiones, public.empresas, public.usuarios

### Community 129 - "vercel.json"
Cohesion: 0.50
Nodes (3): headers, installCommand, rewrites

## Knowledge Gaps
- **467 isolated node(s):** `ItemOcInput`, `OrdenCompraItem`, `ItemImportCompra`, `ItemImportVenta`, `AdminSaasMetrics` (+462 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 948 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **88 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@supabase/supabase-js` connect `ConfiguracionPage` to `PedidoFichaPage.tsx`, `importarVentas.ts`, `App.tsx`, `difusiones.ts`, `tickets.ts`, `insights.ts`, `ContabilidadPage.tsx`, `AdminPage.tsx`, `analytics.ts`, `HomePage.tsx`, `ConfiguracionPage.tsx`, `permisos.ts`, `requireSupabase`, `DevolucionNuevaPage.tsx`, `ventas.ts`, `variantes.ts`, `VentaNuevaPage.tsx`, `inflacion.ts`, `ProductoFormPage.tsx`, `package.json`, `auditoria.ts`, `ProveedorFormPage.tsx`, `ClienteFichaPage.tsx`, `notificaciones.ts`, `InventarioPage.tsx`, `lotes.ts`, `exportarDatos.ts`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `PedidoFichaPage.tsx`, `importarVentas.ts`, `App.tsx`, `difusiones.ts`, `RegistroPage.tsx`, `tickets.ts`, `AnalyticsPage.tsx`, `ContabilidadPage.tsx`, `AdminPage.tsx`, `HomePage.tsx`, `codigoBarras.ts`, `ConfiguracionPage.tsx`, `requireSupabase`, `DevolucionNuevaPage.tsx`, `planes.ts`, `ventas.ts`, `variantes.ts`, `VentaNuevaPage.tsx`, `InsightsPage.tsx`, `ProductoFormPage.tsx`, `InflacionVsPreciosPanel.tsx`, `ProveedorFormPage.tsx`, `ClienteFichaPage.tsx`, `notificaciones.ts`, `OcrFacturaPanel.tsx`, `PedidoNuevaPage.tsx`, `InventarioPage.tsx`, `lotes.ts`, `ParticleNetwork`, `consulta.ts`, `web/package.json`, `main.tsx`, `EscanerCodigoBarras.tsx`, `LandingPage.tsx`, `SetupPage.tsx`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `requireSupabase()` connect `requireSupabase` to `PedidoFichaPage.tsx`, `importarVentas.ts`, `App.tsx`, `difusiones.ts`, `RegistroPage.tsx`, `react`, `tickets.ts`, `AnalyticsPage.tsx`, `ContabilidadPage.tsx`, `AdminPage.tsx`, `HomePage.tsx`, `codigoBarras.ts`, `ConfiguracionPage.tsx`, `DevolucionNuevaPage.tsx`, `ventas.ts`, `variantes.ts`, `ConfiguracionPage`, `VentaNuevaPage.tsx`, `InsightsPage.tsx`, `ProductoFormPage.tsx`, `ProveedorFormPage.tsx`, `ClienteFichaPage.tsx`, `notificaciones.ts`, `PedidoNuevaPage.tsx`, `InventarioPage.tsx`, `lotes.ts`, `crearCliente`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **What connects `ItemOcInput`, `OrdenCompraItem`, `ItemImportCompra` to the rest of the system?**
  _467 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PedidoFichaPage.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05128779395296752 - nodes in this community are weakly interconnected._
- **Should `importarVentas.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0626858842370167 - nodes in this community are weakly interconnected._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05612694681163679 - nodes in this community are weakly interconnected._