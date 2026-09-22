# Graph Report - analitica-360  (2026-09-21)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2332 nodes · 6504 edges · 174 communities (111 shown, 63 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 57 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `791ad91e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- importarVentas.ts
- tickets.ts
- PedidoFichaPage.tsx
- AnalyticsPage.tsx
- ContabilidadPage.tsx
- insights.ts
- VentasPage.tsx
- HomePage.tsx
- listado.tsx
- analytics.ts
- VentaNuevaPage.tsx
- ConfiguracionPage.tsx
- DevolucionNuevaPage.tsx
- InventarioPage.tsx
- ProductosPage.tsx
- AdminPage.tsx
- codigoBarras.ts
- 08-integridad.spec.ts
- variantes.ts
- AppNav.tsx
- ProveedoresPage.tsx
- App.tsx
- planes.ts
- InsightsPage.tsx
- difusiones.ts
- permisos.ts
- inflacion.ts
- ClienteFichaPage.tsx
- package.json
- ClientesPage.tsx
- ParticleNetwork.tsx
- auditoria.ts
- auth.tsx
- cargar
- ComprasPage.tsx
- CompraNuevaPage.tsx
- ConfiguracionPage
- OcrFacturaPanel.tsx
- 039_tickets_soporte.sql
- InventarioLotesTab.tsx
- supabase.ts
- dashboard.ts
- requireSupabase
- dependencies
- useAuth
- compilerOptions
- 035_variantes.sql
- devDependencies
- public.analytics_contar_ventas
- compilerOptions
- 017_clientes.sql
- suscripcion.ts
- scripts
- react
- ResetPasswordPage.tsx
- ParticleNetwork
- public.lotes
- 006_productos.sql
- 007_ventas.sql
- 016_compras.sql
- 052_pedidos.sql
- 058_bugs_auditoria.sql
- 059_ordenes_compra.sql
- manifest.json
- main.tsx
- exportarDatos.ts
- usuarios.ts
- public.ajustar_stock
- usuarios
- EscanerCodigoBarras.tsx
- 034_venta_total_con_interes.sql
- 060_invitaciones_flujo.sql
- public.devoluciones
- categorias.ts
- 025_admin_saas.sql
- 037_numero_venta_anular_compras_categorias.sql
- public.confirmar_venta
- 054_equipo_roles.sql
- LegalLayout.tsx
- fechas.ts
- 003_asignar_y_trial_en_alta.sql
- 022_proveedores.sql
- 032_inventario_movimientos.sql
- 056_permisos_granulares.sql
- 068_senias.sql
- public.analytics_periodo
- public.anulaciones
- public.confirmar_venta
- public.listar_productos_con_stock
- public.confirmar_venta
- .oxlintrc.json
- public.admin_saas_metrics
- public.dashboard_inicio
- public.dashboard_inicio
- public.analytics_periodo
- 033_indices_inventario.sql
- public.gastos
- 070_rol_contador.sql
- public.contar_notificaciones
- 008_cuotas_y_precio_actual.sql
- public.importar_venta
- public.insights_combos
- public.insights_combos_3
- public.analytics_periodo
- emails.ts
- LoginPage
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
- jsbarcode.d.ts
- ocr-factura/index.ts
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
10. `VentaNuevaPage()` - 42 edges

## Surprising Connections (you probably didn't know these)
- `AppRoutes()` --calls--> `useAuth()`  [EXTRACTED]
  src/App.tsx → src/auth.tsx
- `PublicHome()` --calls--> `useAuth()`  [EXTRACTED]
  src/App.tsx → src/auth.tsx
- `ContabilidadPage()` --indirect_call--> `fechaHoyAR()`  [INFERRED]
  src/pages/ContabilidadPage.tsx → src/lib/analytics.ts
- `VentaFichaPage()` --indirect_call--> `fechaHoyAR()`  [INFERRED]
  src/pages/VentaFichaPage.tsx → src/lib/analytics.ts
- `Grafico7Dias` --indirect_call--> `TooltipBarras7Dias()`  [INFERRED]
  src/pages/HomePage.tsx → src/components/CustomTooltip.tsx

## Import Cycles
- None detected.

## Communities (174 total, 63 thin omitted)

### Community 0 - "importarVentas.ts"
Cohesion: 0.06
Nodes (83): papaparse, xlsx, ImportarComprasModal(), ImportarExcelModal(), confirmar(), onArchivo(), sep, ImportarOperacionModal() (+75 more)

### Community 1 - "tickets.ts"
Cohesion: 0.07
Nodes (55): SoporteFichaPage, SoporteNuevoPage, cardShell, PageTitle(), BadgeEstadoTicket(), BadgePrioridadTicket(), ESTADO_STYLE, PRIORIDAD_STYLE (+47 more)

### Community 2 - "PedidoFichaPage.tsx"
Cohesion: 0.10
Nodes (55): mostrarToast(), attrsVariante(), confirmarListoDespacho(), crearPedido(), esEstado(), esOrigen(), ESTADO_STYLE, estiloEstadoPedido() (+47 more)

### Community 3 - "AnalyticsPage.tsx"
Cohesion: 0.07
Nodes (48): propsEjeY(), tamanoTick(), CHART_ACTIVE_BAR, CHART_BAR_BG, CHART_CURSOR_FILL, CHART_TOOLTIP_STYLE, ChartTooltipBox(), colorBarraMargen() (+40 more)

### Community 4 - "ContabilidadPage.tsx"
Cohesion: 0.09
Nodes (45): ContabilidadPage, formatoEjeCompacto(), acumuladoSerie(), calcularValorStock(), cargarContabilidad(), finDeMesClave(), labelMesClave(), mesesAtras() (+37 more)

### Community 5 - "insights.ts"
Cohesion: 0.08
Nodes (46): sumarDiasIso(), agregarPorClave(), armarForecast(), armarVariantes(), bulletsSalud(), calcularElasticidades(), calcularSalud(), cargarInsights() (+38 more)

### Community 6 - "VentasPage.tsx"
Cohesion: 0.10
Nodes (41): jspdf, jspdf-autotable, AnularVentaModal(), confirmar(), ThFilter(), AnalyticsPeriodo, fechaExactaLarga(), ticketPromedio() (+33 more)

### Community 7 - "HomePage.tsx"
Cohesion: 0.08
Nodes (33): lucide-react, recharts, HomePage, ChartResponsive(), intervaloEjeX(), MARGIN_CHART, propsEjeX(), useAltoGrafico() (+25 more)

### Community 8 - "listado.tsx"
Cohesion: 0.09
Nodes (38): OrdenCompraFichaPage, PedidosPage, ProveedorFichaPage, SoportePage, BadgeEstado(), BadgeMargen(), BadgePago(), Breadcrumb() (+30 more)

### Community 9 - "analytics.ts"
Cohesion: 0.09
Nodes (47): agruparEvolucion(), AnalyticsClientes, AnalyticsDiaSemanaRaw, AnalyticsPago, AnalyticsProducto, AnalyticsPunto, AnalyticsTop, anioDeFecha() (+39 more)

### Community 10 - "VentaNuevaPage.tsx"
Cohesion: 0.10
Nodes (37): dispararPedidoCamara(), crearCliente(), listarClientes(), ConfiguracionEmpresa, etiquetaMedioPago(), idMedioAVenta(), ordenarCuotasParaVenta(), desgloseIva() (+29 more)

### Community 11 - "ConfiguracionPage.tsx"
Cohesion: 0.07
Nodes (42): LimitePlanModal(), CONFIG_DEFAULT, fiscalDesdeFila(), FLUJO_VENTAS_DEFAULT, flujoAJson(), FlujoVentas, guardarAsignacionPedidos(), guardarConfiguracion() (+34 more)

### Community 12 - "DevolucionNuevaPage.tsx"
Cohesion: 0.11
Nodes (35): DevolucionNuevaPage, DevolucionesTab(), btnPrimary, buscarVentasDevolucion(), cancelarDevolucion(), DevolucionFicha, DevolucionFila, diferenciaCambio() (+27 more)

### Community 13 - "InventarioPage.tsx"
Cohesion: 0.10
Nodes (39): HistorialMovimientosPanel(), textoReferencia(), PAGE_MOVIMIENTOS, PaginacionBar(), BADGE_ENTRADA, BADGE_SALIDA, deltaStockKardex(), EstadoStock (+31 more)

### Community 14 - "ProductosPage.tsx"
Cohesion: 0.11
Nodes (37): ProductosPage, ProductoVariantesHandle, ean13DesdeEntidad(), etiquetasDeProductos(), estiloTipoMovimiento(), defPlan(), actualizarProducto(), asignarCategoriaProducto() (+29 more)

### Community 15 - "AdminPage.tsx"
Cohesion: 0.09
Nodes (36): AdminPage, AdminCapacidad, AdminPagoFila, AdminSaasMetrics, asRecord(), CAPACIDAD_CERO, cargarAdminCapacidad(), cargarAdminSaasMetrics() (+28 more)

### Community 16 - "codigoBarras.ts"
Cohesion: 0.10
Nodes (35): jsbarcode, CodigoBarrasPreview(), CHECKS, EtiquetaOpcionesModal(), cambiarTamano(), toggle(), TAMANOS, aplicarCamposPorTamano() (+27 more)

### Community 17 - "08-integridad.spec.ts"
Cohesion: 0.17
Nodes (21): envPath, root, ref_node_fs, ref_node_path, ref_node_url, @playwright/test, credencialesListas(), anularUltimaVenta() (+13 more)

### Community 18 - "variantes.ts"
Cohesion: 0.15
Nodes (31): @supabase/supabase-js, AjustarStockModal(), confirmar(), CeldaStockActual(), ProductoVariantesEditor, VarianteDraft, ajustarStock(), MovimientoFila (+23 more)

### Community 19 - "AppNav.tsx"
Cohesion: 0.10
Nodes (22): AppNav(), NotificacionesCampana(), armarItemsNotif(), claveSeen(), contarNotificaciones(), ConteosNotif, EVENTO_NOTIF, guardarSeen() (+14 more)

### Community 20 - "ProveedoresPage.tsx"
Cohesion: 0.14
Nodes (28): ProveedoresPage, PAGE_PROVEEDORES, SearchField(), linkWhatsApp(), actualizarProveedor(), CompraProveedor, CONDICIONES_AFIP, CONDICIONES_PAGO (+20 more)

### Community 21 - "App.tsx"
Cohesion: 0.07
Nodes (23): AnalyticsPage, AppRoutes(), ClienteFichaPage, ClienteFormPage, CompletarAltaPage, CompraNuevaPage, ConfiguracionPage, DevolucionFichaPage (+15 more)

### Community 22 - "planes.ts"
Cohesion: 0.12
Nodes (28): PlanesPage, PlanesModal(), CATALOGO_PLANES, CatalogoPlan, CatalogoPlanId, CicloFacturacion, DESCUENTO_ANUAL, DESCUENTO_LANZAMIENTO (+20 more)

### Community 23 - "InsightsPage.tsx"
Cohesion: 0.09
Nodes (24): fechaHoyAR(), guardarPeriodoAnalytics(), limpiarPeriodoAnalytics(), PresetPeriodo, rangoPreset(), SERIE_INFLACION_VACIA, SerieInflacionPrecios, contarProductosCatalogo() (+16 more)

### Community 24 - "difusiones.ts"
Cohesion: 0.15
Nodes (28): DifusionClientes(), abrirModal(), onChip(), insertarEn(), OPCIONES, truncar(), ClienteFila, cargarLinkTienda() (+20 more)

### Community 25 - "permisos.ts"
Cohesion: 0.14
Nodes (25): PermisosChecklist(), AccesoColaborador, accesoContador(), accesoSoloPedidos(), accesoSoloVentas(), accesoTotal(), accesoVacio(), ACCION_IDS (+17 more)

### Community 26 - "inflacion.ts"
Cohesion: 0.14
Nodes (27): inicioMesIso(), leerPeriodoAnalytics(), acumularPct(), cacheBcra, cargarInflacionVsPrecios(), fechaValidaIso(), fetchBcraTramo(), filasBcra() (+19 more)

### Community 27 - "ClienteFichaPage.tsx"
Cohesion: 0.15
Nodes (24): actualizarCliente(), agregarInteraccion(), ClienteFicha, ClienteInput, COLOR_ETIQUETA, cumpleanosAFecha(), diasHastaCumple(), EtiquetaCliente (+16 more)

### Community 28 - "package.json"
Cohesion: 0.08
Nodes (25): engines, node, name, private, type, version, dotenv, oxlint (+17 more)

### Community 29 - "ClientesPage.tsx"
Cohesion: 0.13
Nodes (25): ClientesPage, ChipsSegmento(), ModalSegmento(), ORDEN, SegmentosCards(), cargarCumpleanosMes(), mesActualMendoza(), cargarSegmentosClientes() (+17 more)

### Community 30 - "ParticleNetwork.tsx"
Cohesion: 0.09
Nodes (20): LandingPage, createParticles(), Particle, speed(), aplicarTema(), COLORES_GRAFICO_DARK, COLORES_GRAFICO_LIGHT, leerTemaGuardado() (+12 more)

### Community 31 - "auditoria.ts"
Cohesion: 0.20
Nodes (24): amarillo(), auditarEmpresa(), bloqCompras(), bloqProductos(), bloqVentas(), bold(), EMPRESAS, enChunks() (+16 more)

### Community 32 - "auth.tsx"
Cohesion: 0.15
Nodes (20): AuthContext, AuthContextValue, AuthProvider(), esRateLimitAuth(), mensajeAuth(), rpcRegistrarEmpresa(), userAgentActual(), AltaPendiente (+12 more)

### Community 33 - "cargar"
Cohesion: 0.16
Nodes (24): cargar(), confirmarCompra(), hoyCompraISO(), actualizarEstadoOc(), armarFicha(), esEstado(), etiquetaAtributos(), formatoFechaOc() (+16 more)

### Community 34 - "ComprasPage.tsx"
Cohesion: 0.17
Nodes (20): CompraFichaPage, ComprasPage, AnularCompraModal(), confirmar(), IconBtn(), PageSkeleton(), OrdenesCompraTab(), anularCompra() (+12 more)

### Community 35 - "CompraNuevaPage.tsx"
Cohesion: 0.15
Nodes (17): AccesoDenegado(), esAtributoColor(), HEX_COLOR, hexDeColor(), VarianteChipsPicker(), etiquetaLoteOpcion(), guardarOrdenCompra(), listarProveedoresEmpresa() (+9 more)

### Community 36 - "ConfiguracionPage"
Cohesion: 0.14
Nodes (17): linkInvitacionColaborador(), textoLinkInvitacion(), etiquetaTipoUbicacion(), eliminarColaborador(), guardarPermisosColaborador(), invitarColaborador(), invitarContador(), atributoTieneVariantesActivas() (+9 more)

### Community 37 - "OcrFacturaPanel.tsx"
Cohesion: 0.18
Nodes (20): Fase, ItemOcrMapeado, OcrFacturaPanel(), aplicar(), armarItems(), elegirArchivo(), payload(), procesar() (+12 more)

### Community 38 - "039_tickets_soporte.sql"
Cohesion: 0.12
Nodes (14): public.asignar_numero_ticket, public.tickets_before_write, public.tickets_respuestas_before_insert, public.tickets, public.tickets_respuestas, public.empresas, public.usuarios, tickets_created_idx (+6 more)

### Community 39 - "InventarioLotesTab.tsx"
Cohesion: 0.19
Nodes (18): BadgeLote(), FiltroEstado, InventarioLotesTab(), abrirModal(), guardarLote(), FilterCollapse(), contarAlertasLotes(), crearLote() (+10 more)

### Community 40 - "supabase.ts"
Cohesion: 0.16
Nodes (17): TOAST_BG, ToastHost(), AuthLike, avisarSesionExpirada(), esErrorAuth(), esErrorRed(), fetchSupabase(), mensajeCargaTabla() (+9 more)

### Community 41 - "dashboard.ts"
Cohesion: 0.17
Nodes (20): lunesIso(), CumpleProximo, asArray(), asRecord(), cargarDashboardInicio(), cargarSerieVentasHome(), DashboardDia, DashboardInicio (+12 more)

### Community 42 - "requireSupabase"
Cohesion: 0.17
Nodes (19): crearProductoParaCompra(), ejecutarConfirmarCompra(), subirImagenFactura(), requireSupabase(), claveLinea(), CompraNuevaPage(), agregarLinea(), agregarProducto() (+11 more)

### Community 43 - "dependencies"
Cohesion: 0.10
Nodes (20): dependencies, jsbarcode, jspdf, jspdf-autotable, lucide-react, papaparse, qrcode, react (+12 more)

### Community 44 - "useAuth"
Cohesion: 0.17
Nodes (16): InactivityWatch(), useAuth(), UpgradePlanPage(), moduloDeRuta(), tieneModulo(), etiquetaModuloPlan(), moduloPlanDeRuta(), planMinimoParaModulo() (+8 more)

### Community 45 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 46 - "035_variantes.sql"
Cohesion: 0.16
Nodes (17): idx_atributos_empresa, idx_items_variante, idx_mov_variante, idx_variantes_producto, public.analytics_variantes(), public.atributos, public.confirmar_venta(), public.producto_variantes (+9 more)

### Community 47 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, dotenv, oxlint, @playwright/test, rollup-plugin-visualizer, tailwindcss, @tailwindcss/vite, terser (+9 more)

### Community 48 - "public.analytics_contar_ventas"
Cohesion: 0.21
Nodes (12): public.analytics_contar_ventas(), public.analytics_evolucion(), public.analytics_top_productos(), public.analytics_variantes(), base, LATERAL, public.producto_variantes, public.productos (+4 more)

### Community 49 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 50 - "017_clientes.sql"
Cohesion: 0.17
Nodes (10): idx_clientes_empresa, idx_clientes_interacciones_cliente, idx_ventas_cliente, public.agregar_interaccion_cliente(), public.clientes, public.clientes_interacciones, public.confirmar_venta(), public.empresas (+2 more)

### Community 51 - "suscripcion.ts"
Cohesion: 0.19
Nodes (14): ordenarPlanesAdmin(), asignarSuscripcionAdmin(), esDemoTrue(), FilaAdminSuscripcion, hoyISO(), iniciarPeriodoPrueba(), listarPlanesAdmin(), listarSuscripcionesAdmin() (+6 more)

### Community 52 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, auditoria, auditoria:acacia, auditoria:analitica, build, dev, lint, prebuild (+6 more)

### Community 53 - "react"
Cohesion: 0.37
Nodes (10): react, react-router-dom, nombreEmpresaInvitacion(), authInputClass, authInputWithIconClass, AuthLayout(), BuildingIcon(), LockIcon() (+2 more)

### Community 54 - "ResetPasswordPage.tsx"
Cohesion: 0.26
Nodes (10): ResetPasswordPage, evaluarPassword(), nivelSeguridad(), PasswordCheck, passwordValida(), requisitosCumplidos(), emailTieneCuenta(), RegistroPage() (+2 more)

### Community 55 - "ParticleNetwork"
Cohesion: 0.29
Nodes (12): leerColores(), ParticleNetwork(), bindObserver(), draw(), medidas(), onResize(), onTema(), onVisibility() (+4 more)

### Community 56 - "public.lotes"
Cohesion: 0.21
Nodes (12): idx_lotes_producto, idx_lotes_vencimiento, idx_mov_lote, public.confirmar_compra(), public.lotes, public.clientes, public.empresas, public.movimientos_inventario (+4 more)

### Community 57 - "006_productos.sql"
Cohesion: 0.24
Nodes (9): idx_mov_empresa_producto, idx_precios_empresa_producto, idx_productos_empresa, public.movimientos_inventario, public.precios_historial, public.productos, public, public.empresas (+1 more)

### Community 58 - "007_ventas.sql"
Cohesion: 0.24
Nodes (8): idx_ventas_empresa_fecha, idx_ventas_items_empresa, idx_ventas_items_venta, public.ventas, public.ventas_items, public.empresas, public.productos, public.usuarios

### Community 59 - "016_compras.sql"
Cohesion: 0.23
Nodes (8): idx_compras_empresa, idx_compras_items_compra, public.compras, public.compras_items, public, public.empresas, public.productos, public.usuarios

### Community 60 - "052_pedidos.sql"
Cohesion: 0.20
Nodes (8): public.pedidos, public.pedidos_items, public.pedidos_numeracion, public.clientes, public.empresas, public.lotes, public.producto_variantes, public.productos

### Community 61 - "058_bugs_auditoria.sql"
Cohesion: 0.24
Nodes (11): public.analytics_periodo(), public.listar_productos_con_stock(), public.listar_productos_empresa(), public.listar_ubicaciones_empresa(), public.ventas_match_cliente(), public.movimientos_inventario, public.producto_variantes, public.productos (+3 more)

### Community 62 - "059_ordenes_compra.sql"
Cohesion: 0.20
Nodes (8): public.ordenes_compra, public.ordenes_compra_items, public.ordenes_compra_numeracion, public, public.empresas, public.producto_variantes, public.productos, public.proveedores

### Community 63 - "manifest.json"
Cohesion: 0.18
Nodes (10): background_color, description, display, icons, name, orientation, permissions, short_name (+2 more)

### Community 64 - "main.tsx"
Cohesion: 0.20
Nodes (8): react-dom, @sentry/react, App(), src_index, hashParams, params, initSentry(), SENSITIVE_FIELDS

### Community 65 - "exportarDatos.ts"
Cohesion: 0.58
Nodes (10): bajarExcel(), exportarDatosClientes(), exportarDatosCompras(), exportarDatosGastos(), exportarDatosInventario(), exportarDatosProductos(), exportarDatosVentas(), fechaArchivo() (+2 more)

### Community 66 - "usuarios.ts"
Cohesion: 0.29
Nodes (6): parseRol(), filaDesdeRow(), filasDesdeListarEquipo(), listarUsuariosEmpresa(), UsuarioEmpresa, Rol

### Community 67 - "public.ajustar_stock"
Cohesion: 0.18
Nodes (9): public.ajustar_stock(), public.clientes, public.compras, public.configuracion_empresa, public.movimientos_inventario, public.productos, public.usuarios, public.ventas (+1 more)

### Community 68 - "usuarios"
Cohesion: 0.33
Nodes (9): auth, empresas, historial_planes, idx_usuarios_empresa, public.get_empresa_id(), public.get_rol(), public.registrar_empresa(), auth.users (+1 more)

### Community 69 - "EscanerCodigoBarras.tsx"
Cohesion: 0.29
Nodes (9): @zxing/browser, @zxing/library, conexionSegura(), EscanerCodigoBarras(), reintentar(), esIphone(), Fase, pedirPermisoCamera() (+1 more)

### Community 70 - "034_venta_total_con_interes.sql"
Cohesion: 0.31
Nodes (8): public.analytics_periodo(), public.confirmar_venta(), public.listar_ventas_empresa(), public.monto_venta(), public.clientes, public.productos, public.ventas, public.ventas_items

### Community 71 - "060_invitaciones_flujo.sql"
Cohesion: 0.24
Nodes (9): public.aceptar_invitacion_colaborador(), public.eliminar_colaborador(), public.email_tiene_cuenta(), public.info_invitacion_empresa(), public.listar_equipo(), auth.users, public.empresas, public.invitaciones_colaboradores (+1 more)

### Community 72 - "public.devoluciones"
Cohesion: 0.22
Nodes (7): public.devoluciones, public.devoluciones_items, public.empresas, public.producto_variantes, public.productos, public.usuarios, public.ventas

### Community 73 - "categorias.ts"
Cohesion: 0.39
Nodes (8): CategoriaFila, eliminarCategoria(), guardarCategoria(), listarCategorias(), mapFila(), msgSql(), sembrarCategoriasDefault(), recargarCategorias()

### Community 74 - "025_admin_saas.sql"
Cohesion: 0.31
Nodes (6): idx_pagos_empresa_fecha, public.admin_saas_metrics(), public.pagos, public.empresas, public.planes, public.suscripciones

### Community 75 - "037_numero_venta_anular_compras_categorias.sql"
Cohesion: 0.31
Nodes (6): public.asignar_numero_venta(), public.categorias, public.sembrar_categorias_default(), public.ventas_numeracion, public.compras_items, public.empresas

### Community 76 - "public.confirmar_venta"
Cohesion: 0.31
Nodes (8): public.confirmar_compra(), public.confirmar_venta(), public.clientes, public.lotes, public.producto_variantes, public.productos, public.proveedores, public.ubicaciones

### Community 77 - "054_equipo_roles.sql"
Cohesion: 0.33
Nodes (8): idx_invitaciones_empresa, public.aceptar_invitacion_colaborador(), public.get_rol(), public.invitaciones_colaboradores, public.invitar_colaborador(), auth.users, public.empresas, public.usuarios

### Community 78 - "LegalLayout.tsx"
Cohesion: 0.32
Nodes (3): PrivacidadPage, TerminosPage, LegalLayout()

### Community 79 - "fechas.ts"
Cohesion: 0.32
Nodes (7): esFechaSoloDia(), formatoFechaDia(), formatoFechaHora(), OPCIONES_DIA, OPCIONES_HORA, TZ_AR, formatoDia()

### Community 80 - "003_asignar_y_trial_en_alta.sql"
Cohesion: 0.25
Nodes (4): public.registrar_empresa(), auth.users, public.planes, public.usuarios

### Community 81 - "022_proveedores.sql"
Cohesion: 0.32
Nodes (4): idx_proveedores_empresa_nombre, public.confirmar_compra(), public.proveedores, public.empresas

### Community 82 - "032_inventario_movimientos.sql"
Cohesion: 0.32
Nodes (7): idx_mov_tipo_fecha, public.listar_resumen_inventario(), public.registrar_traslado(), public.ubicaciones, public.empresas, public.movimientos_inventario, public.productos

### Community 83 - "056_permisos_granulares.sql"
Cohesion: 0.36
Nodes (7): public.aceptar_invitacion_colaborador(), public.colaborador_permisos, public.guardar_colaborador_permisos(), public.invitar_colaborador(), auth.users, public.empresas, public.usuarios

### Community 84 - "068_senias.sql"
Cohesion: 0.32
Nodes (6): public.analytics_periodo(), public.marcar_senia_venta(), public.monto_venta(), public.productos, public.ventas, public.ventas_items

### Community 85 - "public.analytics_periodo"
Cohesion: 0.38
Nodes (6): idx_ventas_empresa_fecha, idx_ventas_items_empresa_venta, public.analytics_periodo(), public.productos, public.ventas, public.ventas_items

### Community 86 - "public.anulaciones"
Cohesion: 0.29
Nodes (6): public.anulaciones, public.anular_venta(), public.empresas, public.usuarios, public.ventas, public.ventas_items

### Community 87 - "public.confirmar_venta"
Cohesion: 0.38
Nodes (6): public.confirmar_venta(), public.listar_productos_con_stock(), public.clientes, public.movimientos_inventario, public.producto_variantes, public.productos

### Community 88 - "public.listar_productos_con_stock"
Cohesion: 0.38
Nodes (6): idx_productos_codigo_barra, public.listar_productos_con_stock(), public.listar_productos_empresa(), public.movimientos_inventario, public.producto_variantes, public.productos

### Community 89 - "public.confirmar_venta"
Cohesion: 0.29
Nodes (6): public.confirmar_venta(), public.clientes, public.lotes, public.producto_variantes, public.productos, public.ubicaciones

### Community 90 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 91 - "public.admin_saas_metrics"
Cohesion: 0.33
Nodes (5): public.pagos, public.admin_saas_metrics(), public.empresas, public.planes, public.suscripciones

### Community 92 - "public.dashboard_inicio"
Cohesion: 0.33
Nodes (5): public.dashboard_inicio(), public.movimientos_inventario, public.productos, public.ventas, public.ventas_items

### Community 93 - "public.dashboard_inicio"
Cohesion: 0.33
Nodes (5): public.dashboard_inicio(), public.movimientos_inventario, public.productos, public.ventas, public.ventas_items

### Community 94 - "public.analytics_periodo"
Cohesion: 0.33
Nodes (5): public.analytics_periodo(), public.clientes, public.productos, public.ventas, public.ventas_items

### Community 95 - "033_indices_inventario.sql"
Cohesion: 0.40
Nodes (5): idx_movimientos_producto, idx_movimientos_tipo, idx_ubicaciones_empresa, public.movimientos_inventario, public.ubicaciones

### Community 96 - "public.gastos"
Cohesion: 0.40
Nodes (5): idx_gastos_empresa_fecha, public.gastos, public, public.empresas, public.usuarios

### Community 97 - "070_rol_contador.sql"
Cohesion: 0.47
Nodes (5): public.aceptar_invitacion_colaborador(), public.get_rol(), public.invitar_contador(), auth.users, public.usuarios

### Community 98 - "public.contar_notificaciones"
Cohesion: 0.40
Nodes (4): public.tickets, public.contar_notificaciones(), public.lotes, public.pedidos

### Community 100 - "public.importar_venta"
Cohesion: 0.40
Nodes (4): public.importar_venta(), public.clientes, public.producto_variantes, public.productos

### Community 101 - "public.insights_combos"
Cohesion: 0.40
Nodes (4): public.insights_combos(), productos, ventas, ventas_items

### Community 102 - "public.insights_combos_3"
Cohesion: 0.40
Nodes (4): public.insights_combos_3(), productos, ventas, ventas_items

### Community 103 - "public.analytics_periodo"
Cohesion: 0.40
Nodes (4): public.analytics_periodo(), public.productos, public.ventas, public.ventas_items

### Community 105 - "LoginPage"
Cohesion: 0.67
Nodes (3): LoginPage(), enviarRecupero(), onOlvido()

### Community 107 - "public.mi_suscripcion_activa"
Cohesion: 0.50
Nodes (3): public.mi_suscripcion_activa(), public.planes, public.suscripciones

### Community 109 - "public.importar_venta"
Cohesion: 0.50
Nodes (3): public.importar_venta(), public.clientes, public.productos

### Community 110 - "public.confirmar_compra"
Cohesion: 0.50
Nodes (3): public.confirmar_compra(), public.producto_variantes, public.proveedores

### Community 113 - "public.anular_venta"
Cohesion: 0.50
Nodes (3): public.anular_venta(), public.ventas, public.ventas_items

### Community 114 - "public.segmentos_clientes"
Cohesion: 0.50
Nodes (3): public.segmentos_clientes(), public.clientes, public.ventas

### Community 115 - "public.difusiones"
Cohesion: 0.50
Nodes (3): public.difusiones, public.empresas, public.usuarios

### Community 116 - "vercel.json"
Cohesion: 0.50
Nodes (3): headers, installCommand, rewrites

## Knowledge Gaps
- **301 isolated node(s):** `ItemImportCompra`, `ItemImportVenta`, `Linea`, `Linea`, `TabId` (+296 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 694 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **63 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `requireSupabase()` connect `requireSupabase` to `importarVentas.ts`, `tickets.ts`, `PedidoFichaPage.tsx`, `AnalyticsPage.tsx`, `ContabilidadPage.tsx`, `VentasPage.tsx`, `HomePage.tsx`, `listado.tsx`, `VentaNuevaPage.tsx`, `ConfiguracionPage.tsx`, `DevolucionNuevaPage.tsx`, `InventarioPage.tsx`, `ProductosPage.tsx`, `AdminPage.tsx`, `variantes.ts`, `AppNav.tsx`, `ProveedoresPage.tsx`, `InsightsPage.tsx`, `difusiones.ts`, `ClienteFichaPage.tsx`, `ClientesPage.tsx`, `auth.tsx`, `cargar`, `ComprasPage.tsx`, `CompraNuevaPage.tsx`, `ConfiguracionPage`, `InventarioLotesTab.tsx`, `supabase.ts`, `suscripcion.ts`, `react`, `ResetPasswordPage.tsx`, `categorias.ts`, `LoginPage`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Why does `@supabase/supabase-js` connect `variantes.ts` to `importarVentas.ts`, `tickets.ts`, `PedidoFichaPage.tsx`, `ContabilidadPage.tsx`, `insights.ts`, `VentasPage.tsx`, `analytics.ts`, `ConfiguracionPage.tsx`, `DevolucionNuevaPage.tsx`, `InventarioPage.tsx`, `ProductosPage.tsx`, `AdminPage.tsx`, `AppNav.tsx`, `ProveedoresPage.tsx`, `difusiones.ts`, `permisos.ts`, `inflacion.ts`, `ClienteFichaPage.tsx`, `package.json`, `ClientesPage.tsx`, `auditoria.ts`, `auth.tsx`, `cargar`, `ComprasPage.tsx`, `InventarioLotesTab.tsx`, `supabase.ts`, `dashboard.ts`, `suscripcion.ts`, `exportarDatos.ts`, `usuarios.ts`, `categorias.ts`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `importarVentas.ts`, `tickets.ts`, `PedidoFichaPage.tsx`, `AnalyticsPage.tsx`, `ContabilidadPage.tsx`, `VentasPage.tsx`, `HomePage.tsx`, `listado.tsx`, `VentaNuevaPage.tsx`, `ConfiguracionPage.tsx`, `DevolucionNuevaPage.tsx`, `InventarioPage.tsx`, `ProductosPage.tsx`, `AdminPage.tsx`, `codigoBarras.ts`, `variantes.ts`, `AppNav.tsx`, `ProveedoresPage.tsx`, `App.tsx`, `planes.ts`, `InsightsPage.tsx`, `difusiones.ts`, `ClienteFichaPage.tsx`, `package.json`, `ClientesPage.tsx`, `ParticleNetwork.tsx`, `auth.tsx`, `ComprasPage.tsx`, `CompraNuevaPage.tsx`, `OcrFacturaPanel.tsx`, `InventarioLotesTab.tsx`, `supabase.ts`, `ResetPasswordPage.tsx`, `main.tsx`, `EscanerCodigoBarras.tsx`, `LegalLayout.tsx`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **What connects `ItemImportCompra`, `ItemImportVenta`, `Linea` to the rest of the system?**
  _301 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `importarVentas.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.060626858842370165 - nodes in this community are weakly interconnected._
- **Should `tickets.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07033315705975675 - nodes in this community are weakly interconnected._
- **Should `PedidoFichaPage.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09739866908650938 - nodes in this community are weakly interconnected._