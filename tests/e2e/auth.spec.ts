import { expect, test } from '@playwright/test';

/**
 * Ensure the user is authenticated. Handles both /setup and /login redirects.
 * Waits for the app to finish loading before checking the URL.
 */
async function ensureAuthenticated(page: import('@playwright/test').Page) {
  await page.goto('/');

  // Wait for React app to finish auth check and redirect
  await page.waitForLoadState('networkidle');

  const url = page.url();
  if (url.includes('/setup')) {
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.fill('input[id="confirmPassword"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  } else if (url.includes('/login')) {
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  }

  // Wait for dashboard to be ready
  await expect(
    page.locator('button:has-text("Create Library"), button:has-text("New Library")')
  ).toBeVisible({ timeout: 15000 });
}

/**
 * Create a library through the UI by clicking the create button and filling the modal.
 */
async function createLibraryViaUI(
  page: import('@playwright/test').Page,
  name: string,
  path: string
) {
  const createBtn = page.locator('button:has-text("Create Library")');
  const newBtn = page.locator('button:has-text("New Library")');

  if (await createBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await createBtn.click();
  } else if (await newBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await newBtn.click();
  }

  // Wait for the modal to appear
  await expect(page.locator('input[placeholder="My Notes"]')).toBeVisible({ timeout: 10000 });
  await page.fill('input[placeholder="My Notes"]', name);
  await page.fill('input[placeholder="my-notes"]', path);
  await page.click('button:has-text("Create")');

  // Wait for library to be created and visible
  await expect(page.locator(`text=${name}`)).toBeVisible({ timeout: 10000 });
}

/**
 * Ensure a library exists. If not, create one through the UI.
 */
async function ensureLibraryExists(page: import('@playwright/test').Page) {
  // If "New Library" button is visible, a library already exists
  const newLibraryBtn = page.locator('button:has-text("New Library")');
  if (await newLibraryBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    return;
  }

  await createLibraryViaUI(page, 'Test Library', 'test-library');
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
    await createLibraryViaUI(page, 'Test Library', 'test-library');
  });
});

test.describe('Editor', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    await ensureLibraryExists(page);
  });

  test('should create and edit a note', async ({ page }) => {
    await page.click('button:has-text("New Note")');
    await expect(page.locator('textarea, .prose')).toBeVisible();
  });
});
