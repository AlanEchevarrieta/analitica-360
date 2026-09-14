import { expect, test } from '@playwright/test'
import { TEST_ACACIA, TEST_USER, hayCredencialesAdmin } from './config'
import { hoyISO } from './helpers/dinero'
import { loginComoAdmin, loginCon } from './helpers/login'

test.beforeEach(() => {
  test.skip(
    !hayCredencialesAdmin() || TEST_USER.password === 'tu_contraseña_acá',
    'Completá TEST_PASSWORD en tests/.env.test',
  )
})

test('el usuario no ve datos de otras empresas (marca de empresa)', async ({ page }) => {
  await loginComoAdmin(page)
  const empresa = page.locator('.app-nav-brand-empresa')
  await expect(empresa).toBeVisible()
  const nombre = ((await empresa.textContent()) ?? '').trim()
  expect(nombre.length).toBeGreaterThan(0)
  expect(nombre.toLowerCase()).not.toMatch(/acacia/)

  await page.goto('/productos')
  await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.app-nav-brand-empresa')).toHaveText(nombre)
})

test('Analytics filtra por empresa', async ({ page }) => {
  await loginComoAdmin(page)
  const empresa = ((await page.locator('.app-nav-brand-empresa').textContent()) ?? '').trim()
  await page.goto('/analytics')
  await page.getByRole('button', { name: 'Rango personalizado' }).click()
  await page.locator('label', { hasText: 'Desde' }).locator('input[type="date"]').fill('2026-01-01')
  await page.locator('label', { hasText: 'Hasta' }).locator('input[type="date"]').fill(hoyISO())
  await page.getByRole('button', { name: 'Aplicar filtro' }).click()
  await expect(page.getByText('Total ventas')).toBeVisible({ timeout: 20000 })
  await expect(page.locator('.app-nav-brand-empresa')).toHaveText(empresa)
  await expect(page.getByText(/Acacia/i)).toHaveCount(0)
})

test('usuario de Acacia no ve datos de otras empresas', async ({ page }) => {
  test.skip(
    !TEST_ACACIA.email || !TEST_ACACIA.password,
    'Definí TEST_ACACIA_EMAIL y TEST_ACACIA_PASSWORD para este caso',
  )
  await loginCon(page, TEST_ACACIA.email, TEST_ACACIA.password)
  const empresa = ((await page.locator('.app-nav-brand-empresa').textContent()) ?? '').trim()
  expect(empresa.toLowerCase()).toMatch(/acacia/)
  await page.goto('/productos')
  await expect(page.locator('.app-nav-brand-empresa')).toHaveText(empresa)
  await expect(page.locator('.app-nav-brand-empresa')).not.toHaveText(/Analítica 360/i)
})
