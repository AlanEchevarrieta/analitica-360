import { expect, test } from '@playwright/test'
import { TEST_USER, hayCredencialesAdmin } from './config'
import { hoyISO } from './helpers/dinero'
import { loginComoAdmin } from './helpers/login'

test.beforeEach(() => {
  test.skip(
    !hayCredencialesAdmin() || TEST_USER.password === 'tu_contraseña_acá',
    'Completá TEST_PASSWORD en tests/.env.test',
  )
})

test('listado muestra ventas con rango 2026 y se puede registrar y anular una venta', async ({
  page,
}) => {
  await loginComoAdmin(page)
  await page.goto('/ventas')
  await page.locator('#venta-desde').fill('2026-01-01')
  await page.locator('#venta-hasta').fill(hoyISO())
  await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15000 })

  await page.goto('/ventas/nueva')
  await page.waitForLoadState('networkidle')

  const primerProducto = page.locator('button, div[role="button"]').filter({
    hasText: /Cinta aisladora|Clavo|Tornillo/,
  }).first()
  if (await primerProducto.isVisible().catch(() => false)) {
    await primerProducto.click()
    await page.waitForTimeout(3000)
  }

  await page.locator('input[placeholder*="Buscar" i], input[placeholder*="producto" i]').first().fill('Cinta')
  await page.waitForTimeout(1000)
  await page.locator('[data-producto], tr, li').filter({ hasText: 'Cinta' }).first().click()
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

  await page.goto('/ventas')
  await page.locator('#venta-desde').fill('2026-01-01')
  await page.locator('#venta-hasta').fill(hoyISO())
  await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15000 })

  await page.getByRole('button', { name: 'Anular venta' }).first().click({ force: true })
  await page.locator('textarea').fill('TEST_PLAYWRIGHT')
  await page.getByRole('button', { name: 'Confirmar anulación' }).click()
  await expect(page.getByText(/Anulada/i).first()).toBeVisible({ timeout: 15000 })
})
