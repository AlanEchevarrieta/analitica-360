import { expect, test } from '@playwright/test'
import { TEST_USER, hayCredencialesAdmin } from './config'
import { loginComoAdmin } from './helpers/login'

const NOMBRE_TEST = 'TEST_PLAYWRIGHT_DELETE'

test.beforeEach(() => {
  test.skip(
    !hayCredencialesAdmin() || TEST_USER.password === 'tu_contraseña_acá',
    'Completá TEST_PASSWORD en tests/.env.test',
  )
})

async function buscarProducto(page: import('@playwright/test').Page, nombre: string) {
  const buscador = page.getByPlaceholder('Buscar producto...')
  await buscador.fill(nombre)
  await page.waitForTimeout(400)
}

test('listado carga con al menos 1 producto y stock no negativo', async ({ page }) => {
  await loginComoAdmin(page)
  await page.goto('/productos')
  await expect(page.getByRole('heading', { name: 'Productos' })).toBeVisible({ timeout: 15000 })
  const filas = page.locator('table tbody tr')
  await expect(filas.first()).toBeVisible()
  expect(await filas.count()).toBeGreaterThan(0)
  await expect(page.getByText(/⚠️\s*-\d/)).toHaveCount(0)
})

test('crear producto TEST_PLAYWRIGHT_DELETE, verlo en el listado y desactivarlo', async ({
  page,
}) => {
  await loginComoAdmin(page)
  await page.goto('/productos')
  await page.waitForLoadState('networkidle')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(1000)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  await buscarProducto(page, NOMBRE_TEST)
  const existente = page.getByText('TEST_PLAYWRIGHT_DELETE')
  if (await existente.first().isVisible().catch(() => false)) {
    page.once('dialog', (d) => d.accept())
    const fila = page.locator('tr').filter({ hasText: 'TEST_PLAYWRIGHT_DELETE' })
    await fila.getByRole('button').last().click()
    await page.waitForTimeout(800)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
  }

  await page.goto('/productos/nuevo')
  await page.waitForLoadState('networkidle')
  await page.locator('label', { hasText: 'Nombre' }).locator('input').fill(NOMBRE_TEST)
  const precio = page.locator('label', { hasText: /Precio de venta/ }).locator('input')
  await precio.fill('100')
  const costo = page.locator('label', { hasText: /^Costo/ }).locator('input')
  if (await costo.count()) await costo.fill('40')
  await page.getByRole('button', { name: 'GUARDAR' }).click()
  await page.waitForTimeout(2000)
  const url = page.url()
  if (!url.includes('/productos') || url.includes('/nuevo')) {
    await page.goto('/productos')
  }
  await page.waitForLoadState('networkidle')

  await buscarProducto(page, NOMBRE_TEST)
  await expect(page.getByText(NOMBRE_TEST).first()).toBeVisible()

  page.once('dialog', (d) => d.accept())
  const filaFinal = page.locator('tr').filter({ hasText: 'TEST_PLAYWRIGHT_DELETE' })
  await filaFinal.getByRole('button').last().click()
  await page.keyboard.press('Escape')
})
