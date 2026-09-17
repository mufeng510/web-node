import { expect, test } from '@playwright/test';

/**
 * Ensure the user is authenticated. Handles both /setup and /login redirects.
 * Waits for the app to finish loading before checking the URL.
 */
async function ensureAuthenticated(page: import('@playwright/test').Page) {
  await page.goto('/');

  // Wait for React app to finish auth check and redirect
  // The app makes 2-3 API calls (setup-status, auth/me, libraries) before stabilizing
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

  // Wait for dashboard to be ready - either "Create Library" (no library) or "New Library" (library exists)
  await expect(
    page.locator('button:has-text("Create Library"), button:has-text("New Library")')
  ).toBeVisible({ timeout: 15000 });
}

/**
 * Ensure a library exists. If not, create one through the UI.
 * After this function, a library is selected and "New Note" button is visible.
 */
async function ensureLibraryExists(page: import('@playwright/test').Page) {
  // If "New Library" button is visible, a library already exists
  const newLibraryBtn = page.locator('button:has-text("New Library")');
  if (await newLibraryBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    return;
  }

  // No library exists - create one through the UI
  const createBtn = page.locator('button:has-text("Create Library")');
  await expect(createBtn).toBeVisible({ timeout: 5000 });
  await createBtn.click();

  // Fill the modal
  await page.fill('input[placeholder="My Notes"]', 'Test Library');
  await page.fill('input[placeholder="my-notes"]', 'test-library');
  await page.click('button:has-text("Create")');

  // Wait for the library to be created and selected
  // After creation, the Dashboard shows "New Library" button
  await expect(newLibraryBtn).toBeVisible({ timeout: 10000 });
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
    const createBtn = page.locator('button:has-text("Create Library")');
    const newBtn = page.locator('button:has-text("New Library")');

    if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createBtn.click();
    } else if (await newBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await newBtn.click();
    }

    await page.fill('input[placeholder="My Notes"]', 'Test Library');
    await page.fill('input[placeholder="my-notes"]', 'test-library');
    await page.click('button:has-text("Create")');
    await expect(page.locator('text=Test Library')).toBeVisible();
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
