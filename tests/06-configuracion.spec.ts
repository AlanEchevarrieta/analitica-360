import { expect, test } from '@playwright/test'
import { TEST_USER, hayCredencialesAdmin } from './config'
import { loginComoAdmin } from './helpers/login'

test.beforeEach(() => {
  test.skip(
    !hayCredencialesAdmin() || TEST_USER.password === 'tu_contraseña_acá',
    'Completá TEST_PASSWORD en tests/.env.test',
  )
})

test('sección Equipo carga sin error', async ({ page }) => {
  await loginComoAdmin(page)
  await page.goto('/configuracion?tab=usuarios')
  await expect(page.getByText('Equipo — Usuarios y colaboradores')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('p.text-red-200, p.text-red-700')).toHaveCount(0)
})

test('toggle de tema funciona (cambia clase dark)', async ({ page }) => {
  await loginComoAdmin(page)
  await page.goto('/configuracion')
  const html = page.locator('html')
  const teniaDark = await html.evaluate((el) => el.classList.contains('dark'))
  await page.getByRole('button', { name: /Cambiar a modo/ }).click()
  await expect.poll(async () => html.evaluate((el) => el.classList.contains('dark'))).toBe(!teniaDark)
})

test('ubicaciones muestra lista', async ({ page }) => {
  await loginComoAdmin(page)
  await page.goto('/configuracion?tab=ubicaciones')
  await expect(page.getByText('Ubicaciones').first()).toBeVisible({ timeout: 15000 })
  await expect(page.locator('ul li').first()).toBeVisible()
})
