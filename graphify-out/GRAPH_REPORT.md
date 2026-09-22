# Graph Report - analitica-360  (2026-09-22)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2734 nodes · 7040 edges · 218 communities (131 shown, 87 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 60 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `791ad91e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- importarVentas.ts
- clientes.ts
- RegistroPage.tsx
- listado.tsx
- AnalyticsPage.tsx
- ContabilidadPage.tsx
- useAuth
- requireSupabase
- insights.ts
- pedidos.ts
- CompraNuevaPage
- analytics.ts
- ConfiguracionPage.tsx
- HomePage.tsx
- codigoBarras.ts
- ProveedorFichaPage.tsx
- App.tsx
- AdminPage.tsx
- permisos.ts
- devoluciones.ts
- ConfiguracionPage
- 08-integridad.spec.ts
- ventas.ts
- tickets.ts
- InsightsPage.tsx
- InventarioPage.tsx
- planes.ts
- variantes.ts
- VentaNuevaPage.tsx
- inflacion.ts
- api/package.json
- ParticleNetwork
- auditoria.ts
- @nestjs/common
- usuarios.repository.ts
- package.json
- usuarios.service.ts
- @supabase/supabase-js
- OcrFacturaPanel.tsx
- PedidoNuevaPage
- roles.guard.ts
- 039_tickets_soporte.sql
- clerk-auth.guard.ts
- compilerOptions
- dependencies
- dashboard.ts
- compilerOptions
- rol.types.ts
- compilerOptions
- notificaciones.ts
- routes.tsx
- devDependencies
- scripts
- formatoARS
- consulta.ts
- 035_variantes.sql
- devDependencies
- public.analytics_contar_ventas
- compilerOptions
- web/package.json
- 017_clientes.sql
- suscripcion.ts
- scripts
- layout.tsx
- public.lotes
- shared-types/package.json
- VentaNuevaPage
- 006_productos.sql
- tasks
- dependencies
- ubicaciones.ts
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
- @clerk/nextjs
- usuarios
- 034_venta_total_con_interes.sql
- 060_invitaciones_flujo.sql
- public.devoluciones
- devDependencies
- TicketBadges.tsx
- 025_admin_saas.sql
- 037_numero_venta_anular_compras_categorias.sql
- public.confirmar_venta
- 054_equipo_roles.sql
- empresa-scope.guard.ts
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
- PrismaService
- dependencies
- .oxlintrc.json
- public.admin_saas_metrics
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
- etiquetaEstadoPedido
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
- `AppRoutes()` --calls--> `useAuth()`  [EXTRACTED]
  src/App.tsx → src/auth.tsx
- `PublicHome()` --calls--> `useAuth()`  [EXTRACTED]
  src/App.tsx → src/auth.tsx
- `VentaFichaPage()` --indirect_call--> `fechaHoyAR()`  [INFERRED]
  src/pages/VentaFichaPage.tsx → src/lib/analytics.ts
- `VentaNuevaPage()` --indirect_call--> `idMedioAVenta()`  [INFERRED]
  src/pages/VentaNuevaPage.tsx → src/lib/configuracion.ts
- `Grafico7Dias` --indirect_call--> `TooltipBarras7Dias()`  [INFERRED]
  src/pages/HomePage.tsx → src/components/CustomTooltip.tsx

## Import Cycles
- None detected.

## Communities (218 total, 87 thin omitted)

### Community 0 - "importarVentas.ts"
Cohesion: 0.06
Nodes (83): papaparse, xlsx, ImportarComprasModal(), ImportarExcelModal(), confirmar(), onArchivo(), ImportarOperacionModal(), cargar() (+75 more)

### Community 1 - "clientes.ts"
Cohesion: 0.06
Nodes (64): DifusionClientes(), abrirModal(), onChip(), insertarEn(), OPCIONES, truncar(), ChipsSegmento(), ModalSegmento() (+56 more)

### Community 2 - "RegistroPage.tsx"
Cohesion: 0.05
Nodes (50): PrivacidadPage, TerminosPage, AuthProvider(), esRateLimitAuth(), mensajeAuth(), rpcRegistrarEmpresa(), userAgentActual(), AltaPendiente (+42 more)

### Community 3 - "listado.tsx"
Cohesion: 0.12
Nodes (46): FiltroEstado, BadgeEstado(), BadgePago(), btnPrimary, btnPrimaryDesk, COLOR_PAGO, EmptyState(), FabLink() (+38 more)

### Community 4 - "AnalyticsPage.tsx"
Cohesion: 0.06
Nodes (54): recharts, ChartResponsive(), intervaloEjeX(), MARGIN_CHART, propsEjeX(), propsEjeY(), tamanoTick(), useAltoGrafico() (+46 more)

### Community 5 - "ContabilidadPage.tsx"
Cohesion: 0.07
Nodes (56): ContabilidadPage, ChartTooltipBox(), BadgeLote(), fechaHoyAR(), formatoEjeCompacto(), inicioMesIso(), acumuladoSerie(), calcularValorStock() (+48 more)

### Community 6 - "useAuth"
Cohesion: 0.13
Nodes (26): react, react-router-dom, AuthContext, AuthContextValue, useAuth(), AccesoDenegado(), AppNav(), sep (+18 more)

### Community 7 - "requireSupabase"
Cohesion: 0.08
Nodes (47): ProductosPage, CodigoBarrasPreview(), HistorialMovimientosPanel(), textoReferencia(), InventarioLotesTab(), abrirModal(), guardarLote(), LimitePlanModal() (+39 more)

### Community 8 - "insights.ts"
Cohesion: 0.07
Nodes (47): simple-statistics, sumarDiasIso(), agregarPorClave(), armarForecast(), armarVariantes(), bulletsSalud(), calcularElasticidades(), calcularSalud() (+39 more)

### Community 9 - "pedidos.ts"
Cohesion: 0.08
Nodes (49): attrsVariante(), confirmarListoDespacho(), esEstado(), esOrigen(), ESTADO_STYLE, EstadoPedido, ESTADOS_PEDIDO, etiquetaItemPedido() (+41 more)

### Community 10 - "CompraNuevaPage"
Cohesion: 0.08
Nodes (43): CompraFicha, confirmarCompra(), crearProductoParaCompra(), ejecutarConfirmarCompra(), hoyCompraISO(), listarComprasPaginado(), mapCompras(), mensajeErrorCompras() (+35 more)

### Community 11 - "analytics.ts"
Cohesion: 0.10
Nodes (44): agruparEvolucion(), AnalyticsClientes, AnalyticsDiaSemanaRaw, AnalyticsPago, AnalyticsProducto, AnalyticsPunto, AnalyticsTop, anioDeFecha() (+36 more)

### Community 12 - "ConfiguracionPage.tsx"
Cohesion: 0.08
Nodes (40): CONFIG_DEFAULT, fiscalDesdeFila(), FLUJO_VENTAS_DEFAULT, flujoAJson(), FlujoVentas, guardarAsignacionPedidos(), guardarConfiguracion(), guardarFiscal() (+32 more)

### Community 13 - "HomePage.tsx"
Cohesion: 0.08
Nodes (28): lucide-react, HomePage, asRechartsTooltip(), CHART_CURSOR_FILL, TooltipInflacionPrecios(), useIndiceBarraActiva(), GraficoExpandible(), SelectorChips() (+20 more)

### Community 14 - "codigoBarras.ts"
Cohesion: 0.10
Nodes (38): jsbarcode, qrcode, CHECKS, EtiquetaOpcionesModal(), cambiarTamano(), toggle(), TAMANOS, aplicarCamposPorTamano() (+30 more)

### Community 15 - "ProveedorFichaPage.tsx"
Cohesion: 0.11
Nodes (33): ProveedorFichaPage, ProveedorFormPage, linkWhatsApp(), actualizarProveedor(), CompraProveedor, CONDICIONES_AFIP, CONDICIONES_PAGO, crearProveedor() (+25 more)

### Community 16 - "App.tsx"
Cohesion: 0.05
Nodes (30): AnalyticsPage, AppRoutes(), ClienteFichaPage, ClienteFormPage, ClientesPage, CompletarAltaPage, CompraFichaPage, CompraNuevaPage (+22 more)

### Community 17 - "AdminPage.tsx"
Cohesion: 0.09
Nodes (32): AdminPage, AdminCapacidad, AdminPagoFila, AdminSaasMetrics, asRecord(), CAPACIDAD_CERO, cargarAdminCapacidad(), cargarAdminSaasMetrics() (+24 more)

### Community 18 - "permisos.ts"
Cohesion: 0.12
Nodes (31): PermisosChecklist(), resolverAsignacionPedido(), AccesoColaborador, accesoContador(), accesoSoloPedidos(), accesoSoloVentas(), accesoTotal(), accesoVacio() (+23 more)

### Community 19 - "devoluciones.ts"
Cohesion: 0.10
Nodes (32): DevolucionesTab(), buscarVentasDevolucion(), cancelarDevolucion(), DevolucionFicha, DevolucionFila, diferenciaCambio(), EstadoDevolucion, estiloEstadoDevolucion() (+24 more)

### Community 20 - "ConfiguracionPage"
Cohesion: 0.10
Nodes (29): CategoriaFila, eliminarCategoria(), guardarCategoria(), listarCategorias(), mapFila(), msgSql(), sembrarCategoriasDefault(), etiquetaEstadoSuscripcion() (+21 more)

### Community 21 - "08-integridad.spec.ts"
Cohesion: 0.17
Nodes (21): envPath, root, ref_node_fs, ref_node_path, ref_node_url, @playwright/test, credencialesListas(), anularUltimaVenta() (+13 more)

### Community 22 - "ventas.ts"
Cohesion: 0.13
Nodes (32): jspdf, jspdf-autotable, ticketPromedio(), exportarAnalyticsPdf(), exportarVentasExcel(), exportarVentasPdf(), fechaArchivo(), filasExcel() (+24 more)

### Community 23 - "tickets.ts"
Cohesion: 0.10
Nodes (34): esAdminEmail(), avisarNuevoTicketAdmin(), avisarRespuestaCliente(), avisarSoporteNotif(), BannerTicketHome, cambiarEstadoTicket(), CATEGORIAS_TICKET, CategoriaTicket (+26 more)

### Community 24 - "InsightsPage.tsx"
Cohesion: 0.09
Nodes (24): InsightsPage, guardarPeriodoAnalytics(), limpiarPeriodoAnalytics(), PresetPeriodo, rangoPreset(), SERIE_INFLACION_VACIA, contarProductosCatalogo(), GranularidadForecast (+16 more)

### Community 25 - "InventarioPage.tsx"
Cohesion: 0.11
Nodes (28): InventarioPage, cargar(), actualizarCliente(), agregarInteraccion(), cumpleanosAFecha(), etiquetaTipo(), EstadoStock, etiquetaEstadoStock() (+20 more)

### Community 26 - "planes.ts"
Cohesion: 0.10
Nodes (29): PlanesModal(), UpgradePlanPage(), CATALOGO_PLANES, CatalogoPlan, CatalogoPlanId, CicloFacturacion, claseBadgePlan(), clavePlan() (+21 more)

### Community 27 - "variantes.ts"
Cohesion: 0.18
Nodes (26): CeldaStockActual(), ProductoVariantesEditor, ProductoVariantesHandle, VarianteDraft, AnalyticsVariantes, asegurarVariante(), ATRIBUTOS_DEFAULT, combinacionesDe() (+18 more)

### Community 28 - "VentaNuevaPage.tsx"
Cohesion: 0.12
Nodes (23): esAtributoColor(), HEX_COLOR, hexDeColor(), VarianteChipsPicker(), listarClientes(), ConfiguracionEmpresa, etiquetaMedioPago(), idMedioAVenta() (+15 more)

### Community 29 - "inflacion.ts"
Cohesion: 0.14
Nodes (26): leerPeriodoAnalytics(), acumularPct(), cacheBcra, cargarInflacionVsPrecios(), fechaValidaIso(), fetchBcraTramo(), filasBcra(), finMesIso() (+18 more)

### Community 30 - "api/package.json"
Cohesion: 0.08
Nodes (23): author, description, license, name, private, type, version, oxlint (+15 more)

### Community 31 - "ParticleNetwork"
Cohesion: 0.14
Nodes (23): PlanesPage, createParticles(), leerColores(), ParticleNetwork(), bindObserver(), draw(), medidas(), onResize() (+15 more)

### Community 32 - "auditoria.ts"
Cohesion: 0.20
Nodes (24): amarillo(), auditarEmpresa(), bloqCompras(), bloqProductos(), bloqVentas(), bold(), EMPRESAS, enChunks() (+16 more)

### Community 33 - "@nestjs/common"
Cohesion: 0.15
Nodes (14): AppController, Controller, AppModule, Module, AppService, Public(), AuthModule, Module (+6 more)

### Community 34 - "usuarios.repository.ts"
Cohesion: 0.14
Nodes (10): RolCrudo, InMemoryUsuariosRepository, Injectable, EmpresaRecord, UpsertEmpresaInput, UpsertUsuarioInput, UsuarioRecord, UsuariosRepository (+2 more)

### Community 35 - "package.json"
Cohesion: 0.10
Nodes (20): engines, node, react, react-dom, name, packageManager, private, type (+12 more)

### Community 36 - "usuarios.service.ts"
Cohesion: 0.16
Nodes (15): ClerkKnownWebhookEvent, ClerkOrganizationCreatedEvent, ClerkOrganizationMembershipDeletedEvent, ClerkOrganizationMembershipEvent, ClerkWebhookEvent, Controller, UsuariosController, USUARIOS_REPOSITORY (+7 more)

### Community 37 - "@supabase/supabase-js"
Cohesion: 0.13
Nodes (19): @supabase/supabase-js, AjustarStockModal(), confirmar(), BADGE_ENTRADA, BADGE_SALIDA, deltaStockKardex(), filaResumen(), LineaTraslado (+11 more)

### Community 38 - "OcrFacturaPanel.tsx"
Cohesion: 0.18
Nodes (20): Fase, ItemOcrMapeado, OcrFacturaPanel(), aplicar(), armarItems(), elegirArchivo(), payload(), procesar() (+12 more)

### Community 39 - "PedidoNuevaPage"
Cohesion: 0.17
Nodes (18): crearCliente(), mostrarToast(), registrarTraslado(), registrarTrasladoMasivo(), lotesDisponiblesProducto(), crearPedido(), stockDe(), stockPorUbicaciones() (+10 more)

### Community 40 - "roles.guard.ts"
Cohesion: 0.13
Nodes (13): ClerkAuthContext, EmpresaContext, express, Request, UsuarioContext, AccesoColaborador, Rol, CurrentEmpresa (+5 more)

### Community 41 - "039_tickets_soporte.sql"
Cohesion: 0.12
Nodes (14): public.asignar_numero_ticket, public.tickets_before_write, public.tickets_respuestas_before_insert, public.tickets, public.tickets_respuestas, public.empresas, public.usuarios, tickets_created_idx (+6 more)

### Community 42 - "clerk-auth.guard.ts"
Cohesion: 0.14
Nodes (11): ClerkAuthGuard, Injectable, Env, envSchema, validateEnv(), InternalWebhookGuard, Injectable, @clerk/backend (+3 more)

### Community 43 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowSyntheticDefaultImports, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, incremental, isolatedModules (+11 more)

### Community 44 - "dependencies"
Cohesion: 0.10
Nodes (20): dependencies, jsbarcode, jspdf, jspdf-autotable, lucide-react, papaparse, qrcode, react (+12 more)

### Community 45 - "dashboard.ts"
Cohesion: 0.18
Nodes (19): lunesIso(), asArray(), asRecord(), cargarDashboardInicio(), cargarSerieVentasHome(), DashboardDia, DashboardInicio, DashboardProducto (+11 more)

### Community 46 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 47 - "rol.types.ts"
Cohesion: 0.17
Nodes (12): AccionClave, ACCIONES, ACCIONES_CONTADOR, ModuloClave, MODULOS, MODULOS_CONTADOR, tieneAccion(), tieneModulo() (+4 more)

### Community 48 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 49 - "notificaciones.ts"
Cohesion: 0.19
Nodes (18): armarItemsNotif(), claveSeen(), contarNotificaciones(), ConteosNotif, EVENTO_NOTIF, guardarSeen(), IdNotif, ItemNotif (+10 more)

### Community 50 - "routes.tsx"
Cohesion: 0.15
Nodes (14): moduloDeRuta(), tieneModulo(), moduloPlanDeRuta(), esDueno(), GateModulos(), RequireAuth(), RequireCompletarAlta(), RequireDueno() (+6 more)

### Community 51 - "devDependencies"
Cohesion: 0.11
Nodes (18): devDependencies, dotenv, oxlint, @playwright/test, rollup-plugin-visualizer, tailwindcss, @tailwindcss/vite, terser (+10 more)

### Community 52 - "scripts"
Cohesion: 0.11
Nodes (18): scripts, auditoria, auditoria:acacia, auditoria:analitica, build, dev, lint, new:build (+10 more)

### Community 53 - "formatoARS"
Cohesion: 0.18
Nodes (16): AnularCompraModal(), confirmar(), AnularVentaModal(), confirmar(), OrdenesCompraTab(), anularCompra(), CompraFila, formatoFechaCompra() (+8 more)

### Community 54 - "consulta.ts"
Cohesion: 0.18
Nodes (15): TOAST_BG, ToastHost(), AuthLike, avisarSesionExpirada(), esErrorAuth(), esErrorRed(), fetchSupabase(), MSG_SESION_EXPIRADA (+7 more)

### Community 55 - "035_variantes.sql"
Cohesion: 0.16
Nodes (17): idx_atributos_empresa, idx_items_variante, idx_mov_variante, idx_variantes_producto, public.analytics_variantes(), public.atributos, public.confirmar_venta(), public.producto_variantes (+9 more)

### Community 56 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, @nestjs/cli, @nestjs/mau, @nestjs/schematics, @nestjs/testing, oxlint, prettier, prisma (+9 more)

### Community 57 - "public.analytics_contar_ventas"
Cohesion: 0.21
Nodes (12): public.analytics_contar_ventas(), public.analytics_evolucion(), public.analytics_top_productos(), public.analytics_variantes(), base, LATERAL, public.producto_variantes, public.productos (+4 more)

### Community 58 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 59 - "web/package.json"
Cohesion: 0.13
Nodes (14): eslintConfig, svix, name, packageManager, private, version, tailwindcss, @types/node (+6 more)

### Community 60 - "017_clientes.sql"
Cohesion: 0.17
Nodes (10): idx_clientes_empresa, idx_clientes_interacciones_cliente, idx_ventas_cliente, public.agregar_interaccion_cliente(), public.clientes, public.clientes_interacciones, public.confirmar_venta(), public.empresas (+2 more)

### Community 61 - "suscripcion.ts"
Cohesion: 0.19
Nodes (14): ordenarPlanesAdmin(), asignarSuscripcionAdmin(), esDemoTrue(), FilaAdminSuscripcion, hoyISO(), iniciarPeriodoPrueba(), listarPlanesAdmin(), listarSuscripcionesAdmin() (+6 more)

### Community 62 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, deploy, format, lint, start, start:debug, start:dev (+6 more)

### Community 63 - "layout.tsx"
Cohesion: 0.14
Nodes (7): nextConfig, apps_web_src_app_globals, geistMono, geistSans, metadata, next, svix

### Community 64 - "public.lotes"
Cohesion: 0.21
Nodes (12): idx_lotes_producto, idx_lotes_vencimiento, idx_mov_lote, public.confirmar_compra(), public.lotes, public.clientes, public.empresas, public.movimientos_inventario (+4 more)

### Community 65 - "shared-types/package.json"
Cohesion: 0.15
Nodes (12): dependencies, zod, main, name, private, scripts, build, lint (+4 more)

### Community 66 - "VentaNuevaPage"
Cohesion: 0.22
Nodes (9): confirmarVenta(), VentaNuevaPage(), agregarLinea(), agregarProducto(), confirmar(), crearClienteInline(), elegirCliente(), onCodigoDetectado() (+1 more)

### Community 67 - "006_productos.sql"
Cohesion: 0.24
Nodes (9): idx_mov_empresa_producto, idx_precios_empresa_producto, idx_productos_empresa, public.movimientos_inventario, public.precios_historial, public.productos, public, public.empresas (+1 more)

### Community 68 - "tasks"
Cohesion: 0.15
Nodes (12): dependsOn, outputs, cache, persistent, dependsOn, $schema, tasks, build (+4 more)

### Community 69 - "dependencies"
Cohesion: 0.17
Nodes (12): dependencies, @clerk/backend, dotenv, @nestjs/common, @nestjs/config, @nestjs/core, @nestjs/platform-express, @prisma/client (+4 more)

### Community 70 - "ubicaciones.ts"
Cohesion: 0.24
Nodes (11): eliminarUbicacion(), etiquetaTipoUbicacion(), guardarUbicacion(), listarUbicaciones(), mapFila(), msgSql(), normalizarTipo(), TIPOS_UBICACION (+3 more)

### Community 71 - "007_ventas.sql"
Cohesion: 0.24
Nodes (8): idx_ventas_empresa_fecha, idx_ventas_items_empresa, idx_ventas_items_venta, public.ventas, public.ventas_items, public.empresas, public.productos, public.usuarios

### Community 72 - "016_compras.sql"
Cohesion: 0.23
Nodes (8): idx_compras_empresa, idx_compras_items_compra, public.compras, public.compras_items, public, public.empresas, public.productos, public.usuarios

### Community 73 - "052_pedidos.sql"
Cohesion: 0.20
Nodes (8): public.pedidos, public.pedidos_items, public.pedidos_numeracion, public.clientes, public.empresas, public.lotes, public.producto_variantes, public.productos

### Community 74 - "058_bugs_auditoria.sql"
Cohesion: 0.24
Nodes (11): public.analytics_periodo(), public.listar_productos_con_stock(), public.listar_productos_empresa(), public.listar_ubicaciones_empresa(), public.ventas_match_cliente(), public.movimientos_inventario, public.producto_variantes, public.productos (+3 more)

### Community 75 - "059_ordenes_compra.sql"
Cohesion: 0.20
Nodes (8): public.ordenes_compra, public.ordenes_compra_items, public.ordenes_compra_numeracion, public, public.empresas, public.producto_variantes, public.productos, public.proveedores

### Community 76 - "manifest.json"
Cohesion: 0.18
Nodes (10): background_color, description, display, icons, name, orientation, permissions, short_name (+2 more)

### Community 77 - "main.tsx"
Cohesion: 0.20
Nodes (8): react-dom, @sentry/react, App(), src_index, hashParams, params, initSentry(), SENSITIVE_FIELDS

### Community 78 - "EscanerCodigoBarras.tsx"
Cohesion: 0.27
Nodes (10): @zxing/browser, @zxing/library, conexionSegura(), dispararPedidoCamara(), EscanerCodigoBarras(), reintentar(), esIphone(), Fase (+2 more)

### Community 79 - "LandingPage.tsx"
Cohesion: 0.18
Nodes (6): LandingPage, FEATURES, InstallPwaBlock(), ParticleNetwork, PLANES, RUBROS

### Community 80 - "exportarDatos.ts"
Cohesion: 0.58
Nodes (10): bajarExcel(), exportarDatosClientes(), exportarDatosCompras(), exportarDatosGastos(), exportarDatosInventario(), exportarDatosProductos(), exportarDatosVentas(), fechaArchivo() (+2 more)

### Community 81 - "public.ajustar_stock"
Cohesion: 0.18
Nodes (9): public.ajustar_stock(), public.clientes, public.compras, public.configuracion_empresa, public.movimientos_inventario, public.productos, public.usuarios, public.ventas (+1 more)

### Community 82 - "@clerk/nextjs"
Cohesion: 0.20
Nodes (3): config, isPublicRoute, @clerk/nextjs

### Community 83 - "usuarios"
Cohesion: 0.33
Nodes (9): auth, empresas, historial_planes, idx_usuarios_empresa, public.get_empresa_id(), public.get_rol(), public.registrar_empresa(), auth.users (+1 more)

### Community 84 - "034_venta_total_con_interes.sql"
Cohesion: 0.31
Nodes (8): public.analytics_periodo(), public.confirmar_venta(), public.listar_ventas_empresa(), public.monto_venta(), public.clientes, public.productos, public.ventas, public.ventas_items

### Community 85 - "060_invitaciones_flujo.sql"
Cohesion: 0.24
Nodes (9): public.aceptar_invitacion_colaborador(), public.eliminar_colaborador(), public.email_tiene_cuenta(), public.info_invitacion_empresa(), public.listar_equipo(), auth.users, public.empresas, public.invitaciones_colaboradores (+1 more)

### Community 86 - "public.devoluciones"
Cohesion: 0.22
Nodes (7): public.devoluciones, public.devoluciones_items, public.empresas, public.producto_variantes, public.productos, public.usuarios, public.ventas

### Community 87 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node, @types/react, @types/react-dom (+1 more)

### Community 88 - "TicketBadges.tsx"
Cohesion: 0.28
Nodes (7): BadgeEstadoTicket(), BadgePrioridadTicket(), ESTADO_STYLE, PRIORIDAD_STYLE, EstadoTicket, etiquetaEstado(), etiquetaPrioridad()

### Community 89 - "025_admin_saas.sql"
Cohesion: 0.31
Nodes (6): idx_pagos_empresa_fecha, public.admin_saas_metrics(), public.pagos, public.empresas, public.planes, public.suscripciones

### Community 90 - "037_numero_venta_anular_compras_categorias.sql"
Cohesion: 0.31
Nodes (6): public.asignar_numero_venta(), public.categorias, public.sembrar_categorias_default(), public.ventas_numeracion, public.compras_items, public.empresas

### Community 91 - "public.confirmar_venta"
Cohesion: 0.31
Nodes (8): public.confirmar_compra(), public.confirmar_venta(), public.clientes, public.lotes, public.producto_variantes, public.productos, public.proveedores, public.ubicaciones

### Community 92 - "054_equipo_roles.sql"
Cohesion: 0.33
Nodes (8): idx_invitaciones_empresa, public.aceptar_invitacion_colaborador(), public.get_rol(), public.invitaciones_colaboradores, public.invitar_colaborador(), auth.users, public.empresas, public.usuarios

### Community 93 - "empresa-scope.guard.ts"
Cohesion: 0.29
Nodes (5): normalizarRol(), IS_PUBLIC_KEY, EmpresaScopeGuard, Inject, Injectable

### Community 94 - "003_asignar_y_trial_en_alta.sql"
Cohesion: 0.25
Nodes (4): public.registrar_empresa(), auth.users, public.planes, public.usuarios

### Community 95 - "022_proveedores.sql"
Cohesion: 0.32
Nodes (4): idx_proveedores_empresa_nombre, public.confirmar_compra(), public.proveedores, public.empresas

### Community 96 - "032_inventario_movimientos.sql"
Cohesion: 0.32
Nodes (7): idx_mov_tipo_fecha, public.listar_resumen_inventario(), public.registrar_traslado(), public.ubicaciones, public.empresas, public.movimientos_inventario, public.productos

### Community 97 - "056_permisos_granulares.sql"
Cohesion: 0.36
Nodes (7): public.aceptar_invitacion_colaborador(), public.colaborador_permisos, public.guardar_colaborador_permisos(), public.invitar_colaborador(), auth.users, public.empresas, public.usuarios

### Community 98 - "068_senias.sql"
Cohesion: 0.32
Nodes (6): public.analytics_periodo(), public.marcar_senia_venta(), public.monto_venta(), public.productos, public.ventas, public.ventas_items

### Community 99 - "oxlint.json"
Cohesion: 0.29
Nodes (6): env, node, rules, @typescript-eslint/no-explicit-any, @typescript-eslint/no-floating-promises, $schema

### Community 100 - "tsconfig.build.json"
Cohesion: 0.29
Nodes (6): compilerOptions, rootDir, exclude, extends, include, ./tsconfig.json

### Community 101 - "public.analytics_periodo"
Cohesion: 0.38
Nodes (6): idx_ventas_empresa_fecha, idx_ventas_items_empresa_venta, public.analytics_periodo(), public.productos, public.ventas, public.ventas_items

### Community 102 - "public.anulaciones"
Cohesion: 0.29
Nodes (6): public.anulaciones, public.anular_venta(), public.empresas, public.usuarios, public.ventas, public.ventas_items

### Community 103 - "public.confirmar_venta"
Cohesion: 0.38
Nodes (6): public.confirmar_venta(), public.listar_productos_con_stock(), public.clientes, public.movimientos_inventario, public.producto_variantes, public.productos

### Community 104 - "public.listar_productos_con_stock"
Cohesion: 0.38
Nodes (6): idx_productos_codigo_barra, public.listar_productos_con_stock(), public.listar_productos_empresa(), public.movimientos_inventario, public.producto_variantes, public.productos

### Community 105 - "public.confirmar_venta"
Cohesion: 0.29
Nodes (6): public.confirmar_venta(), public.clientes, public.lotes, public.producto_variantes, public.productos, public.ubicaciones

### Community 106 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 107 - "PrismaService"
Cohesion: 0.33
Nodes (3): PrismaService, Injectable, @prisma/client

### Community 108 - "dependencies"
Cohesion: 0.33
Nodes (6): dependencies, @clerk/nextjs, next, react, react-dom, svix

### Community 109 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 110 - "public.admin_saas_metrics"
Cohesion: 0.33
Nodes (5): public.pagos, public.admin_saas_metrics(), public.empresas, public.planes, public.suscripciones

### Community 111 - "public.dashboard_inicio"
Cohesion: 0.33
Nodes (5): public.dashboard_inicio(), public.movimientos_inventario, public.productos, public.ventas, public.ventas_items

### Community 112 - "public.dashboard_inicio"
Cohesion: 0.33
Nodes (5): public.dashboard_inicio(), public.movimientos_inventario, public.productos, public.ventas, public.ventas_items

### Community 113 - "public.analytics_periodo"
Cohesion: 0.33
Nodes (5): public.analytics_periodo(), public.clientes, public.productos, public.ventas, public.ventas_items

### Community 114 - "033_indices_inventario.sql"
Cohesion: 0.40
Nodes (5): idx_movimientos_producto, idx_movimientos_tipo, idx_ubicaciones_empresa, public.movimientos_inventario, public.ubicaciones

### Community 115 - "public.gastos"
Cohesion: 0.40
Nodes (5): idx_gastos_empresa_fecha, public.gastos, public, public.empresas, public.usuarios

### Community 116 - "070_rol_contador.sql"
Cohesion: 0.47
Nodes (5): public.aceptar_invitacion_colaborador(), public.get_rol(), public.invitar_contador(), auth.users, public.usuarios

### Community 117 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, start

### Community 118 - "public.contar_notificaciones"
Cohesion: 0.40
Nodes (4): public.tickets, public.contar_notificaciones(), public.lotes, public.pedidos

### Community 121 - "public.importar_venta"
Cohesion: 0.40
Nodes (4): public.importar_venta(), public.clientes, public.producto_variantes, public.productos

### Community 122 - "public.insights_combos"
Cohesion: 0.40
Nodes (4): public.insights_combos(), productos, ventas, ventas_items

### Community 123 - "public.insights_combos_3"
Cohesion: 0.40
Nodes (4): public.insights_combos_3(), productos, ventas, ventas_items

### Community 124 - "public.analytics_periodo"
Cohesion: 0.40
Nodes (4): public.analytics_periodo(), public.productos, public.ventas, public.ventas_items

### Community 126 - "etiquetaEstadoPedido"
Cohesion: 0.67
Nodes (4): estiloEstadoPedido(), etiquetaEstadoPedido(), BadgeEstado(), BadgeEstado()

### Community 128 - "public.mi_suscripcion_activa"
Cohesion: 0.50
Nodes (3): public.mi_suscripcion_activa(), public.planes, public.suscripciones

### Community 130 - "public.importar_venta"
Cohesion: 0.50
Nodes (3): public.importar_venta(), public.clientes, public.productos

### Community 131 - "public.confirmar_compra"
Cohesion: 0.50
Nodes (3): public.confirmar_compra(), public.producto_variantes, public.proveedores

### Community 134 - "public.anular_venta"
Cohesion: 0.50
Nodes (3): public.anular_venta(), public.ventas, public.ventas_items

### Community 135 - "public.segmentos_clientes"
Cohesion: 0.50
Nodes (3): public.segmentos_clientes(), public.clientes, public.ventas

### Community 136 - "public.difusiones"
Cohesion: 0.50
Nodes (3): public.difusiones, public.empresas, public.usuarios

### Community 137 - "vercel.json"
Cohesion: 0.50
Nodes (3): headers, installCommand, rewrites

## Knowledge Gaps
- **469 isolated node(s):** `ItemImportCompra`, `ItemImportVenta`, `ClienteInput`, `EtiquetaCliente`, `ItemOcInput` (+464 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 949 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **87 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@supabase/supabase-js` connect `@supabase/supabase-js` to `importarVentas.ts`, `clientes.ts`, `ContabilidadPage.tsx`, `useAuth`, `requireSupabase`, `insights.ts`, `pedidos.ts`, `CompraNuevaPage`, `analytics.ts`, `ConfiguracionPage.tsx`, `ProveedorFichaPage.tsx`, `AdminPage.tsx`, `permisos.ts`, `devoluciones.ts`, `ConfiguracionPage`, `ventas.ts`, `tickets.ts`, `variantes.ts`, `inflacion.ts`, `auditoria.ts`, `package.json`, `dashboard.ts`, `notificaciones.ts`, `suscripcion.ts`, `ubicaciones.ts`, `exportarDatos.ts`?**
  _High betweenness centrality (0.116) - this node is a cross-community bridge._
- **Why does `react` connect `useAuth` to `importarVentas.ts`, `clientes.ts`, `RegistroPage.tsx`, `listado.tsx`, `AnalyticsPage.tsx`, `ContabilidadPage.tsx`, `requireSupabase`, `ConfiguracionPage.tsx`, `HomePage.tsx`, `codigoBarras.ts`, `ProveedorFichaPage.tsx`, `App.tsx`, `AdminPage.tsx`, `InsightsPage.tsx`, `InventarioPage.tsx`, `variantes.ts`, `VentaNuevaPage.tsx`, `ParticleNetwork`, `@supabase/supabase-js`, `OcrFacturaPanel.tsx`, `notificaciones.ts`, `formatoARS`, `consulta.ts`, `web/package.json`, `main.tsx`, `EscanerCodigoBarras.tsx`, `LandingPage.tsx`, `SetupPage.tsx`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Why does `@nestjs/common` connect `@nestjs/common` to `usuarios.repository.ts`, `usuarios.service.ts`, `roles.guard.ts`, `clerk-auth.guard.ts`, `PrismaService`, `rol.types.ts`, `empresa-scope.guard.ts`, `api/package.json`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **What connects `ItemImportCompra`, `ItemImportVenta`, `ClienteInput` to the rest of the system?**
  _469 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `importarVentas.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.061711079943899017 - nodes in this community are weakly interconnected._
- **Should `clientes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0567287784679089 - nodes in this community are weakly interconnected._
- **Should `RegistroPage.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.052429667519181586 - nodes in this community are weakly interconnected._