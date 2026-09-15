import { expect, test } from '@playwright/test'
import { TEST_USER, hayCredencialesAdmin } from './config'
import { loginComoAdmin } from './helpers/login'

function credencialesListas() {
  return hayCredencialesAdmin() && TEST_USER.password !== 'tu_contraseña_acá'
}

test('login correcto llega a /inicio', async ({ page }) => {
  test.skip(!credencialesListas(), 'Completá TEST_PASSWORD en tests/.env.test')
  await loginComoAdmin(page)
  await expect(page).toHaveURL(/\/inicio/)
})

test('login con contraseña vacía muestra error', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[type="email"]', TEST_USER.email || 'prueba@example.com')
  await page.fill('input[type="password"]', '')
  await page.click('button[type="submit"]')
  await expect(page.getByText('La contraseña debe tener al menos')).toBeVisible()
})

test('cerrar sesión redirige a /login', async ({ page }) => {
  test.skip(!credencialesListas(), 'Completá TEST_PASSWORD en tests/.env.test')
  await loginComoAdmin(page)
  await page.getByRole('button', { name: 'Cerrar sesión' }).first().click()
  await page.waitForURL('**/login', { timeout: 10000 })
  await expect(page).toHaveURL(/\/login/)
})
