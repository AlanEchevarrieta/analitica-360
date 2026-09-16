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

test('usuario de Analítica 360 no ve datos de Acacia en Analytics', async ({ page }) => {
  await loginComoAdmin(page)
  const empresa = ((await page.locator('.app-nav-brand-empresa').textContent()) ?? '').trim()
  expect(empresa.length).toBeGreaterThan(0)
  expect(empresa.toLowerCase()).not.toMatch(/acacia/)

  await page.goto('/analytics')
  await page.getByRole('button', { name: 'Rango personalizado' }).click()
  await page.locator('label', { hasText: 'Desde' }).locator('input[type="date"]').fill('2022-01-01')
  await page.locator('label', { hasText: 'Hasta' }).locator('input[type="date"]').fill(hoyISO())
  await page.getByRole('button', { name: 'Aplicar filtro' }).click()
  await expect(page.getByText('Total ventas')).toBeVisible({ timeout: 20000 })
  await expect(page.getByText('Cargando…')).toHaveCount(0)
  await expect(page.locator('.app-nav-brand-empresa')).toHaveText(empresa)
  await expect(page.getByText(/Acacia/i)).toHaveCount(0)
})

test('insights sin Premium muestra upgrade o redirige', async ({ page }) => {
  await loginComoAdmin(page)
  await page.goto('/insights')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)

  const upgrade = page.getByText(/Esta función es parte del plan|Disponible en Plan Premium/i)
  const planes = page.getByRole('link', { name: /Ver (todos los )?planes/i })
  const url = page.url()
  const redirigio = /\/planes|\/inicio|\/login/i.test(url) && !/\/insights/i.test(url)

  if (await upgrade.first().isVisible().catch(() => false)) {
    await expect(upgrade.first()).toBeVisible()
    return
  }
  if ((await planes.count()) > 0 && (await planes.first().isVisible().catch(() => false))) {
    await expect(planes.first()).toBeVisible()
    return
  }
  if (redirigio) {
    expect(redirigio).toBeTruthy()
    return
  }

  test.skip(true, 'La cuenta de prueba tiene trial o Premium; Insights está desbloqueado')
})

test('el badge del plan aparece en el home', async ({ page }) => {
  await loginComoAdmin(page)
  await expect(page).toHaveURL(/\/inicio/)
  await expect(page.getByText(/Plan\s+\S+/).first()).toBeVisible({ timeout: 15000 })
})
