import { expect, test } from '@playwright/test';

/**
 * Ensure the user is authenticated. If setup is needed, complete it.
 * Works whether setup was already done or not.
 */
async function ensureAuthenticated(page: import('@playwright/test').Page) {
  await page.goto('/');

  // If we got redirected to /setup, complete the setup wizard
  if (page.url().includes('/setup')) {
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.fill('input[id="confirmPassword"]', 'password123');
    await page.click('button[type="submit"]');
  }

  // Wait until we're on the main page and it's fully loaded
  await expect(page).toHaveURL('/');
  await expect(page.locator('text=Files')).toBeVisible({ timeout: 10000 });
}

test.describe('Authentication', () => {
  test('should redirect to setup on first visit', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/setup');
  });

  test('should complete setup wizard', async ({ page }) => {
    await page.goto('/setup');
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.fill('input[id="confirmPassword"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });
});

test.describe('Library Management', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('should create a new library', async ({ page }) => {
    await page.click('button:has-text("New Library")');
    await page.fill('input[placeholder="My Notes"]', 'Test Library');
    await page.fill('input[placeholder="my-notes"]', 'test-library');
    await page.click('button:has-text("Create")');
    await expect(page.locator('text=Test Library')).toBeVisible();
  });
});

test.describe('Editor', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    await page.click('button:has-text("New Library")');
    await page.fill('input[placeholder="My Notes"]', 'Test Library');
    await page.fill('input[placeholder="my-notes"]', 'test-library');
    await page.click('button:has-text("Create")');
  });

  test('should create and edit a note', async ({ page }) => {
    await page.click('button:has-text("New Note")');
    await expect(page.locator('textarea, .prose')).toBeVisible();
  });
});
