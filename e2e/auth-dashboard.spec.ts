import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'
const testEmail    = `e2e-${Date.now()}@clutch.test`
const testPassword = 'TestPass123!'

test.describe('Authentication', () => {
  test('register → redirects to dashboard', async ({ page }) => {
    await page.goto(`${BASE}/auth/register`)
    await page.fill('input[type="email"]', testEmail)
    await page.fill('input[type="password"]', testPassword)
    await page.fill('input[placeholder*="Confirm"]', testPassword)
    await page.click('button[type="submit"]')
    await page.waitForURL(`${BASE}/dashboard`)
    expect(page.url()).toContain('/dashboard')
  })

  test('login with valid credentials', async ({ page }) => {
    await page.goto(`${BASE}/auth/login`)
    await page.fill('input[type="email"]', testEmail)
    await page.fill('input[type="password"]', testPassword)
    await page.click('button[type="submit"]')
    await page.waitForURL(`${BASE}/dashboard`)
    expect(page.url()).toContain('/dashboard')
  })

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto(`${BASE}/auth/login`)
    await page.fill('input[type="email"]', testEmail)
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')
    await expect(page.locator('text=Invalid')).toBeVisible()
  })

  test('unauthenticated user redirected to login', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`)
    await page.waitForURL(`${BASE}/auth/login`)
    expect(page.url()).toContain('/auth/login')
  })
})

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Log in before each test
    await page.goto(`${BASE}/auth/login`)
    await page.fill('input[type="email"]', testEmail)
    await page.fill('input[type="password"]', testPassword)
    await page.click('button[type="submit"]')
    await page.waitForURL(`${BASE}/dashboard`)
  })

  test('shows empty state with no pockets', async ({ page }) => {
    await expect(page.locator('text=No pockets yet')).toBeVisible()
  })

  test('create a pocket', async ({ page }) => {
    await page.click('button:has-text("New pocket")')
    await page.fill('input[placeholder*="Pocket"]', 'My Test Pocket')
    await page.click('button:has-text("Create")')
    await expect(page.locator('text=My Test Pocket')).toBeVisible()
  })

  test('navigate to pocket detail', async ({ page }) => {
    await page.click('text=View pocket')
    await expect(page.locator('button:has-text("Add wallet")')).toBeVisible()
  })

  test('sidebar navigation works', async ({ page }) => {
    await page.click('a:has-text("Wallets")')
    await expect(page).toHaveURL(`${BASE}/dashboard/wallets`)

    await page.click('a:has-text("Activity")')
    await expect(page).toHaveURL(`${BASE}/dashboard/activity`)

    await page.click('a:has-text("Settings")')
    await expect(page).toHaveURL(`${BASE}/dashboard/settings`)
  })

  test('settings page shows chain health', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/settings`)
    await expect(page.locator('text=Chain connectivity')).toBeVisible()
  })
})

test.describe('Wallet management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/auth/login`)
    await page.fill('input[type="email"]', testEmail)
    await page.fill('input[type="password"]', testPassword)
    await page.click('button[type="submit"]')
    await page.waitForURL(`${BASE}/dashboard`)
    await page.click('text=View pocket')
  })

  test('add an EVM wallet', async ({ page }) => {
    await page.click('button:has-text("Add wallet")')
    await page.fill('input[placeholder*="0x"]', '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')
    await page.selectOption('select[name="chain"], select >> nth=0', 'ethereum')
    await page.click('button:has-text("Add wallet") >> nth=1')
    await expect(page.locator('text=ethereum')).toBeVisible()
  })

  test('sync balances', async ({ page }) => {
    await page.click('button:has-text("Sync balances")')
    await expect(page.locator('text=Syncing')).toBeVisible()
  })
})
