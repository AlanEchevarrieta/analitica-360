import { expect, test } from '@playwright/test'
import { TEST_USER, hayCredencialesAdmin } from './config'
import { loginComoAdmin } from './helpers/login'

test.beforeEach(() => {
  test.skip(
    !hayCredencialesAdmin() || TEST_USER.password === 'tu_contraseña_acá',
    'Completá TEST_PASSWORD en tests/.env.test',
  )
})

test('KPI cards tienen texto visible', async ({ page }) => {
  await loginComoAdmin(page)
  await expect(page.getByText('Ventas este mes')).toBeVisible({ timeout: 15000 })
  const mes = page.locator('p', { hasText: 'Ventas este mes' }).locator('xpath=following-sibling::p[1]')
  const valorMes = (await mes.textContent())?.trim() ?? ''
  expect(valorMes.length).toBeGreaterThan(0)
})

test('gráfico de stock está presente', async ({ page }) => {
  await loginComoAdmin(page)
  await expect(page.getByText(/Estado de stock/)).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.recharts-surface').first()).toBeVisible()
})

test('no hay valores en rojo de stock negativo', async ({ page }) => {
  await loginComoAdmin(page)
  await expect(page.getByText(/Estado de stock/)).toBeVisible({ timeout: 15000 })
  await expect(page.getByText(/⚠️\s*-\d/)).toHaveCount(0)
})
