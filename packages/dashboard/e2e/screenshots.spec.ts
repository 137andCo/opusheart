import { test, expect, type Page } from '@playwright/test';
import path from 'path';

const SCREENSHOT_DIR = path.join(__dirname, '..', '..', '..', 'docs', 'screenshots');

// Credentials from demo seed
const ADMIN_EMAIL = 'admin@gracecommunity.church';
const ADMIN_PASSWORD = 'ChangeMe123!';

async function login(page: Page) {
  await page.goto('/login');
  await page.locator('#email').fill(ADMIN_EMAIL);
  // PrimeVue Password wraps input inside a div — target the inner input
  await page.locator('#password input').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  // Wait for redirect to dashboard home
  await page.waitForURL('/', { timeout: 10000 });
  // Let stats load
  await page.waitForTimeout(1000);
}

async function screenshot(page: Page, name: string) {
  // Ensure sidebar is rendered (layout hydrated)
  await page.waitForSelector('.layout-sidebar', { timeout: 5000 }).catch(() => {});
  // Wait for data to load
  await page.waitForTimeout(800);
  // Hide Nuxt devtools badge for clean screenshots
  await page.evaluate(() => {
    const badge = document.querySelector('.__nuxt-devtools-container') as HTMLElement;
    if (badge) badge.style.display = 'none';
  }).catch(() => {});
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${name}.png`),
    fullPage: false,
  });
}

test.describe('Dashboard Screenshots', () => {
  test.setTimeout(120_000);
  test.beforeAll(async ({ browser }) => {
    // Verify the app is reachable
    const context = await browser.newContext();
    const page = await context.newPage();
    const response = await page.goto('http://localhost:3021/login');
    expect(response?.status()).toBeLessThan(400);
    await context.close();
  });

  test('capture all dashboard pages', async ({ page }) => {
    // Login
    await login(page);

    // 1. Dashboard Home
    await screenshot(page, '01-dashboard-home');

    // 2. Members List
    await page.goto('/members');
    await page.waitForTimeout(1000);
    await screenshot(page, '02-members-list');

    // 3. Member Detail (click first row if data exists)
    const memberRow = page.locator('tr[data-pc-section="bodyrow"]').first();
    if (await memberRow.isVisible({ timeout: 2000 }).catch(() => false)) {
      await memberRow.click();
      await page.waitForTimeout(1000);
      await screenshot(page, '03-member-detail');
      await page.goBack();
      await page.waitForTimeout(500);
    }

    // 4. Events
    await page.goto('/events');
    await page.waitForTimeout(1000);
    await screenshot(page, '04-events');

    // 5. Groups
    await page.goto('/groups');
    await page.waitForTimeout(1000);
    await screenshot(page, '05-groups');

    // 6. Sermons
    await page.goto('/sermons');
    await page.waitForTimeout(1000);
    await screenshot(page, '06-sermons');

    // 7. Communication
    await page.goto('/communication');
    await page.waitForTimeout(1000);
    await screenshot(page, '07-communication');

    // 8. Giving
    await page.goto('/giving');
    await page.waitForTimeout(1000);
    await screenshot(page, '08-giving-funds');

    // 9. Pages
    await page.goto('/pages');
    await page.waitForTimeout(1000);
    await screenshot(page, '09-pages');

    // 10. Resources
    await page.goto('/resources');
    await page.waitForTimeout(1000);
    await screenshot(page, '10-resources');

    // 11. Households
    await page.goto('/households');
    await page.waitForTimeout(1000);
    await screenshot(page, '11-households');

    // 12. Care Notes
    await page.goto('/care');
    await page.waitForTimeout(1000);
    await screenshot(page, '12-care-notes');

    // 13. Bookings
    await page.goto('/bookings');
    await page.waitForTimeout(1000);
    await screenshot(page, '13-bookings');

    // 14. Settings
    await page.goto('/settings');
    await page.waitForTimeout(1000);
    await screenshot(page, '14-settings');

    // 15. Login page (logout first)
    await page.evaluate(() => {
      localStorage.removeItem('oh_accessToken');
    });
    await page.goto('/login');
    await page.waitForTimeout(500);
    await screenshot(page, '00-login');
  });
});
