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

function parseStockCelda(texto: string) {
  const total = texto.match(/(\d+)\s*u\s*total/i)
  if (total) return Number(total[1])
  const m = texto.replace(/⚠️/g, '').match(/-?\d+/)
  return m ? Number(m[0]) : NaN
}

async function leerStockProducto(page: Page, nombre: string) {
  await page.goto('/productos')
  await expect(page.getByRole('heading', { name: 'Productos' })).toBeVisible({ timeout: 15000 })
  const buscador = page.getByPlaceholder('Buscar producto...')
  if ((await buscador.count()) > 0) {
    await buscador.fill(nombre)
    await page.waitForTimeout(400)
  }
  const fila = page.locator('table tbody tr').filter({ hasText: nombre }).first()
  await expect(fila).toBeVisible({ timeout: 15000 })
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

async function elegirProductoConStock(page: Page) {
  await page.goto('/productos')
  await expect(page.getByRole('heading', { name: 'Productos' })).toBeVisible({ timeout: 15000 })
  const filas = page.locator('table tbody tr')
  await expect(filas.first()).toBeVisible({ timeout: 15000 })
  const total = await filas.count()
  for (let i = 0; i < total; i++) {
    const fila = filas.nth(i)
    const textoFila = ((await fila.textContent()) ?? '').trim()
    if (/TEST_PLAYWRIGHT/i.test(textoFila)) continue
    const nombre = ((await fila.locator('td').nth(1).locator('p').first().textContent()) ?? '')
      .replace('📷', '')
      .trim()
    if (!nombre) continue
    const celdas = fila.locator('td')
    const n = await celdas.count()
    const stock = parseStockCelda(((await celdas.nth(n - 3).textContent()) ?? '').trim())
    if (Number.isFinite(stock) && stock >= 1) return { nombre, stock }
  }
  throw new Error('No hay un producto con stock ≥ 1 para el test de integridad')
}

async function registrarVentaDeUnaUnidad(page: Page, nombre: string) {
  await page.goto('/ventas/nueva')
  await page.waitForLoadState('networkidle')
  await page.locator('input[placeholder*="Buscar" i], input[placeholder*="producto" i]').first().fill(nombre)
  await page.waitForTimeout(1000)
  await page.locator('[data-producto], tr, li, button').filter({ hasText: nombre }).first().click()
  await page.waitForTimeout(500)
  const agregarVariante = page.getByRole('button', { name: 'Agregar a la venta' })
  if (await agregarVariante.isVisible().catch(() => false)) {
    await agregarVariante.click()
    await page.waitForTimeout(500)
  }
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await page.waitForTimeout(5000)
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('button', { name: 'Efectivo' })).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: 'Efectivo' }).click({ force: true, timeout: 15000 })
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await page.getByRole('button', { name: 'Saltar' }).click()
  await page.getByRole('button', { name: 'CONFIRMAR VENTA' }).click()
  await expect(page.getByText(/Venta registrada/)).toBeVisible({ timeout: 15000 })
  await page.waitForURL('**/inicio', { timeout: 15000 })
}

async function anularUltimaVenta(page: Page, nombreProducto: string) {
  await page.goto('/ventas')
  await page.locator('#venta-desde').fill('2026-01-01')
  await page.locator('#venta-hasta').fill(hoyISO())
  await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15000 })
  const fila = page.locator('table tbody tr').filter({ hasText: nombreProducto }).first()
  const objetivo = (await fila.count()) > 0 ? fila : page.locator('table tbody tr').first()
  await objetivo.getByRole('button', { name: 'Anular venta' }).click({ force: true })
  await page.locator('textarea').fill('TEST_PLAYWRIGHT')
  await page.getByRole('button', { name: 'Confirmar anulación' }).click()
  await expect(page.getByText(/Anulada/i).first()).toBeVisible({ timeout: 15000 })
}

test('venta de 1 unidad baja el stock y anularlo lo restaura', async ({ page }) => {
  await loginComoAdmin(page)
  const producto = await elegirProductoConStock(page)
  const original = await leerStockProducto(page, producto.nombre)
  expect(original).toBeGreaterThanOrEqual(1)

  await registrarVentaDeUnaUnidad(page, producto.nombre)
  const despuesVenta = await leerStockProducto(page, producto.nombre)
  expect(despuesVenta).toBe(original - 1)

  await anularUltimaVenta(page, producto.nombre)
  const despuesAnular = await leerStockProducto(page, producto.nombre)
  expect(despuesAnular).toBe(original)
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
