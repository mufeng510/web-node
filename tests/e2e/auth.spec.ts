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
 * Idempotent: if the library name is already visible, returns early.
 */
async function createLibraryViaUI(
  page: import('@playwright/test').Page,
  name: string,
  path: string
) {
  if (
    await page
      .locator(
        `h1:has-text("${name}"), h2:has-text("${name}"), [data-testid="library-card"]:has-text("${name}"), .library-card:has-text("${name}")`
      )
      .isVisible({ timeout: 2000 })
      .catch(() => false)
  ) {
    return;
  }

  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  const failedResponses: { url: string; status: number; body?: string }[] = [];
  page.on('response', async (resp) => {
    if (resp.url().includes('/api/') && resp.status() >= 400) {
      const body = await resp.text().catch(() => '');
      failedResponses.push({ url: resp.url(), status: resp.status(), body });
    }
  });

  const createBtn = page.locator('button:has-text("Create Library")');
  const newBtn = page.locator('button:has-text("New Library")');

  if (await createBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await createBtn.click();
  } else if (await newBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await newBtn.click();
  }

  await expect(page.locator('input[placeholder="My Notes"]')).toBeVisible({ timeout: 10000 });
  await page.fill('input[placeholder="My Notes"]', name);
  await page.fill('input[placeholder="my-notes"]', path);

  // Wait for the library creation API response
  const createResponse = page.waitForResponse(
    (resp) => resp.url().includes('/api/v1/libraries') && resp.request().method() === 'POST',
    { timeout: 15000 }
  );

  await page.locator('button:has-text("Create")').last().click();

  // Wait for API response to complete
  const response = await createResponse;
  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok()) {
    throw new Error(
      `Library creation failed: ${response.status()} ${JSON.stringify(responseBody)}`
    );
  }

  // Wait for library to become currentLibrary in UI - check for welcome message or New Note button
  try {
    await expect(
      page.locator(`h2:has-text("Welcome to ${name}"), button:has-text("New Note")`).first()
    ).toBeVisible({ timeout: 20000 });
  } catch (e) {
    const detail = [
      `Console errors: ${JSON.stringify(errors)}`,
      `Failed API responses: ${JSON.stringify(failedResponses)}`,
      `Create API response: ${JSON.stringify(responseBody)}`,
      `Page URL: ${page.url()}`,
      `Page title: ${await page.title()}`,
    ].join('\n');
    throw new Error(`Library "${name}" not visible after creation.\n${detail}`);
  }
}

/**
 * Ensure a library exists. If not, create one through the UI.
 */
async function ensureLibraryExists(
  page: import('@playwright/test').Page,
  name = 'Test Library',
  path = 'test-library'
) {
  // Wait for libraries to load - check for either library-selected state or no-library state
  const newLibraryBtn = page.locator('button:has-text("New Library")');
  const welcomeMsg = page.locator('h2:has-text("Welcome to")');
  const createLibraryBtn = page.locator('button:has-text("Create Library")');

  // Wait up to 15s for either library-selected indicators or Create Library button
  try {
    await expect(
      page
        .locator(
          'button:has-text("New Library"), h2:has-text("Welcome to"), button:has-text("Create Library")'
        )
        .first()
    ).toBeVisible({ timeout: 15000 });
  } catch {
    // Continue anyway
  }

  // Check if a library is already selected (New Library button in header OR welcome message)
  if (
    (await newLibraryBtn.isVisible({ timeout: 2000 }).catch(() => false)) ||
    (await welcomeMsg.isVisible({ timeout: 2000 }).catch(() => false))
  ) {
    return;
  }

  // No library selected - check for Create Library button and create one
  if (await createLibraryBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await createLibraryViaUI(page, name, path);
  }
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
    await ensureLibraryExists(page, 'Test Library Editor', 'test-library-editor');
  });

  test('should create and edit a note', async ({ page }) => {
    // Wait for navigation to editor after clicking New Note
    await Promise.all([
      page.waitForURL(/\/editor\//),
      page.click('button:has-text("New Note")'),
    ]);
    // Wait for editor toolbar to appear (WYSIWYG/Source/Read/Save buttons)
    await expect(page.locator('button:has-text("WYSIWYG"), button:has-text("Source"), button:has-text("Read"), button:has-text("Save")').first()).toBeVisible({ timeout: 15000 });
    // Then check for editor content area
    await expect(page.locator('textarea, .prose')).toBeVisible({ timeout: 15000 });
  });
});
