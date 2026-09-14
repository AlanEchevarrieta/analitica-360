import { Page } from '@playwright/test'
import { TEST_USER } from '../config'

export async function loginComoAdmin(page: Page) {
  await page.goto('/login')
  await page.fill('input[type="email"]', TEST_USER.email)
  await page.fill('input[type="password"]', TEST_USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/inicio', { timeout: 10000 })
}

export async function loginCon(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/inicio', { timeout: 10000 })
}
