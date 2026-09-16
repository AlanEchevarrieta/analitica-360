import { expect, test, type Page } from '@playwright/test'
import { TEST_USER, hayCredencialesAdmin } from './config'
import { hoyISO, parseArs, parsePorcentaje } from './helpers/dinero'
import { loginComoAdmin } from './helpers/login'

test.beforeEach(() => {
  test.skip(
    !hayCredencialesAdmin() || TEST_USER.password === 'tu_contraseña_acá',
    'Completá TEST_PASSWORD en tests/.env.test',
  )
})

const STOCK_TIMEOUT = 60000

function parseStockCelda(texto: string) {
  const total = texto.match(/(\d+)\s*u\s*total/i)
  if (total) return Number(total[1])
  const m = texto.replace(/⚠️/g, '').match(/-?\d+/)
  return m ? Number(m[0]) : NaN
}

async function waitIdle(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: STOCK_TIMEOUT })
}

async function leerStockProducto(page: Page, nombre: string) {
  await page.goto('/productos')
  await waitIdle(page)
  await expect(page.getByRole('heading', { name: 'Productos' })).toBeVisible({ timeout: STOCK_TIMEOUT })
  const buscador = page.getByPlaceholder('Buscar producto...')
  if ((await buscador.count()) > 0) {
    await buscador.fill(nombre)
    await waitIdle(page)
  }
  const fila = page.locator('table tbody tr').filter({ hasText: nombre }).first()
  await expect(fila).toBeVisible({ timeout: STOCK_TIMEOUT })
  const celdas = fila.locator('td')
  const n = await celdas.count()
  const texto = ((await celdas.nth(n - 3).textContent()) ?? '').trim()
  const stock = parseStockCelda(texto)
  if (!Number.isFinite(stock)) {
    const fallback = ((await fila.textContent()) ?? '').trim()
    return parseStockCelda(fallback)
  }
  return stock
}

async function registrarVentaDeUnaUnidad(page: Page) {
  await page.goto('/ventas/nueva')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)

  const inputBusqueda = page.locator('input[placeholder*="roducto"], input[placeholder*="uscar"]').first()
  await inputBusqueda.fill('Cinta')
  await page.waitForTimeout(2000)

  const primerResultado = page.locator('tr, li, div[role="option"]')
    .filter({ hasText: 'Cinta' })
    .first()
  await primerResultado.click({ timeout: 15000 })
  await page.waitForTimeout(2000)

  const total = await page.locator('text=/Total.*\\$/').first().textContent()
  console.log('[stock test] total antes de siguiente:', total)

  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Siguiente' }).click({ force: true })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(5000)

  await expect(page.getByRole('button', { name: 'Efectivo' })).toBeVisible({ timeout: STOCK_TIMEOUT })
  await page.getByRole('button', { name: 'Efectivo' }).click({ force: true, timeout: STOCK_TIMEOUT })
  await waitIdle(page)
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await waitIdle(page)
  await page.getByRole('button', { name: 'Saltar' }).click()
  await waitIdle(page)
  await page.getByRole('button', { name: 'CONFIRMAR VENTA' }).click()
  await waitIdle(page)
  await expect(page.getByText(/Venta registrada/)).toBeVisible({ timeout: STOCK_TIMEOUT })
  await page.waitForURL('**/inicio', { timeout: STOCK_TIMEOUT })
  await waitIdle(page)
}

async function anularUltimaVenta(page: Page, nombreProducto: string) {
  await page.goto('/ventas')
  await waitIdle(page)
  await page.locator('#venta-desde').fill('2026-01-01')
  await waitIdle(page)
  await page.locator('#venta-hasta').fill(hoyISO())
  await waitIdle(page)
  await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: STOCK_TIMEOUT })
  console.log('[stock test] anulando producto:', nombreProducto)

  await page.screenshot({ path: 'debug-anulacion-antes.png' })

  const botonAnular = page.getByRole('button', { name: /anular/i })
    .or(page.getByText(/anular venta/i))
    .first()

  console.log('[stock test] botón anular visible:',
    await botonAnular.isVisible().catch(() => false))

  if (!await botonAnular.isVisible().catch(() => false)) {
    await page.goto('/ventas')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'debug-anulacion-listado.png' })
  }

  const esperaRpc = page.waitForResponse(
    (r) => /anular_venta|rpc\/anular/i.test(r.url()),
    { timeout: STOCK_TIMEOUT },
  ).catch(() => null)

  await botonAnular.click({ timeout: 30000 })
  await page.waitForTimeout(2000)

  const motivo = page.locator('textarea').first()
  if (await motivo.isVisible().catch(() => false)) {
    await motivo.fill('TEST_PLAYWRIGHT')
    await page.waitForTimeout(500)
  }

  const confirmar = page.getByRole('button', {
    name: /confirmar|sí|si|aceptar|anular|ok/i,
  }).first()
    .or(page.locator('button.btn-danger, button.btn-red'))
    .first()

  if (await confirmar.isVisible({ timeout: 5000 }).catch(() => false)) {
    await confirmar.click({ force: true })
    await page.waitForTimeout(3000)
    await page.waitForLoadState('networkidle')
  }

  console.log('[stock test] URL después de anular:', page.url())
  await page.screenshot({ path: 'debug-anulacion-despues.png' })
  await waitIdle(page)
  const rpc = await esperaRpc
  const errorUi = ((await page.locator('p.text-red-700, .bg-red-50').first().textContent().catch(() => null)) ?? '').trim()
  const anuladaVisible = await page.getByText(/Anulada/i).first().isVisible().catch(() => false)

  let respuestaAnulacion: Record<string, unknown> = {
    rpcCapturado: Boolean(rpc),
    anuladaVisible,
    errorUi: errorUi || null,
  }
  if (rpc) {
    respuestaAnulacion = {
      ...respuestaAnulacion,
      status: rpc.status(),
      ok: rpc.ok(),
      url: rpc.url(),
      body: await rpc.text().catch(() => ''),
    }
  }

  return respuestaAnulacion
}

test('venta de 1 unidad baja el stock y anularlo lo restaura', async ({ page }) => {
  test.setTimeout(180000)
  await loginComoAdmin(page)
  await waitIdle(page)
  const productoNombre = 'Cinta'
  const stockInicial = await leerStockProducto(page, productoNombre)
  console.log('[stock test] stock inicial:', stockInicial)
  await page.screenshot({ path: 'debug-stock-1-inicio.png' })
  expect(stockInicial).toBeGreaterThanOrEqual(1)

  try {
    await registrarVentaDeUnaUnidad(page)
  } finally {
    await page.screenshot({ path: 'debug-stock-2-post-venta.png' })
  }
  const stockDespuesVenta = await leerStockProducto(page, productoNombre)
  console.log('[stock test] stock después de venta:', stockDespuesVenta)
  expect(stockDespuesVenta).toBe(stockInicial - 1)

  const respuestaAnulacion = await anularUltimaVenta(page, productoNombre)
  console.log('[stock test] respuesta anulación:', respuestaAnulacion)
  await page.screenshot({ path: 'debug-stock-3-post-anulacion.png' })

  const stockDespuesAnulacion = await leerStockProducto(page, productoNombre)
  console.log('[stock test] stock después de anulación:', stockDespuesAnulacion)
  expect(stockDespuesAnulacion).toBe(stockInicial)
})

test('Analytics muestra margen bruto estimado menor a 90%', async ({ page }) => {
  await loginComoAdmin(page)
  await page.goto('/analytics')
  await page.getByText('Rango personalizado').click()
  const desdeId = page.locator('#analytics-desde')
  if ((await desdeId.count()) > 0) {
    await page.fill('#analytics-desde', '2022-01-01')
    await page.fill('#analytics-hasta', hoyISO())
  } else {
    const fechas = page.locator('input[type="date"]')
    await fechas.nth(0).fill('2022-01-01')
    await fechas.nth(1).fill(hoyISO())
  }
  await page.getByRole('button', { name: 'Aplicar filtro' }).click()
  await page.waitForTimeout(3000)
  await expect(page.getByText('Margen bruto estimado')).toBeVisible({ timeout: 20000 })
  await expect(page.getByText('Cargando…')).toHaveCount(0)

  const detalleCostos = page.getByText(/Cargá el costo de tus productos/i)
  if (await detalleCostos.isVisible().catch(() => false)) {
    test.skip(true, 'No hay costos cargados para calcular margen')
  }

  const margen = page.locator('p', { hasText: /Margen bruto/ }).locator('xpath=following-sibling::p[1]')
  const pct = parsePorcentaje((await margen.textContent()) ?? '')
  expect(pct).toBeGreaterThanOrEqual(0)
  expect(pct).toBeLessThan(90)
})

test('Contabilidad muestra Invertido en stock mayor a $0', async ({ page }) => {
  await loginComoAdmin(page)
  await page.goto('/contabilidad')
  await page.getByRole('button', { name: 'Resultado del período' }).click()
  await expect(page.getByText('Invertido en stock')).toBeVisible({ timeout: 20000 })
  const valor = page.locator('p', { hasText: /Invertido en stock/ }).locator('xpath=following-sibling::p[2]')
  const monto = parseArs((await valor.textContent()) ?? '')
  expect(monto).toBeGreaterThan(0)
})
