import { expect, test } from '@playwright/test'
import { TEST_USER, hayCredencialesAdmin } from './config'
import { hoyISO, parseArs, parsePorcentaje } from './helpers/dinero'
import { loginComoAdmin } from './helpers/login'

test.beforeEach(() => {
  test.skip(
    !hayCredencialesAdmin() || TEST_USER.password === 'tu_contraseña_acá',
    'Completá TEST_PASSWORD en tests/.env.test',
  )
})

test('analytics 2026: ventas, transacciones, margen y gráfico con datos', async ({ page }) => {
  await loginComoAdmin(page)
  await page.goto('/analytics')
  await page.getByRole('button', { name: 'Rango personalizado' }).click()
  await page.locator('label', { hasText: 'Desde' }).locator('input[type="date"]').fill('2026-01-01')
  await page.locator('label', { hasText: 'Hasta' }).locator('input[type="date"]').fill(hoyISO())
  await page.getByRole('button', { name: 'Aplicar filtro' }).click()
  await expect(page.getByText('Total ventas')).toBeVisible({ timeout: 20000 })
  await expect(page.getByText('Cargando…')).toHaveCount(0)

  const totalVentas = page.locator('p', { hasText: 'Total ventas' }).locator('xpath=following-sibling::p[1]')
  const transacciones = page.locator('p', { hasText: 'Transacciones' }).locator('xpath=following-sibling::p[1]')
  const margen = page.locator('p', { hasText: /Margen bruto/ }).locator('xpath=following-sibling::p[1]')

  const totalTxt = (await totalVentas.textContent()) ?? ''
  const txTxt = (await transacciones.textContent()) ?? ''
  const margenTxt = (await margen.textContent()) ?? ''

  expect(parseArs(totalTxt)).toBeGreaterThan(0)
  expect(Number(txTxt.replace(/[^\d]/g, ''))).toBeGreaterThan(0)
  const pct = parsePorcentaje(margenTxt)
  expect(pct).not.toBe(100)

  await expect(page.getByText(/Evolución de ventas/)).toBeVisible()
  await expect(page.locator('.recharts-surface').first()).toBeVisible()
  await expect(page.locator('.recharts-bar-rectangle, .recharts-line, .recharts-area').first()).toBeVisible()
})
