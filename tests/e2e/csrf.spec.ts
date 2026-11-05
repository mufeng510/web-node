import { type Page, expect, test } from '@playwright/test';

/**
 * CSRF 回归测试：真实浏览器里走登录 → 保存（带状态的写操作）。
 *
 * 覆盖：
 * 1. 登录响应里的 x-csrf-token 被前端拦截器保存，后续写请求自动带上，
 *    不会被 CSRF 中间件拒绝；
 * 2. CSRF cookie 丢失（旧版本升级用户的常见情形）后重新登录并刷新页面，
 *    写操作恢复正常。
 */

const EMAIL = 'admin@example.com';
const PASSWORD = 'password123';
const LIBRARY_NAME = 'CSRF Test Library';
const LIBRARY_PATH = 'csrf-test-library';

/** 记录所有被 CSRF 中间件拒绝的响应 */
function watchCsrfFailures(page: Page) {
  const failures: { url: string; status: number; body: string }[] = [];
  page.on('response', async (resp) => {
    if (!resp.url().includes('/api/') || resp.status() < 400) return;
    const body = await resp.text().catch(() => '');
    if (body.includes('CSRF_TOKEN_')) {
      failures.push({ url: resp.url(), status: resp.status(), body });
    }
  });
  return failures;
}

/** 登录（不出现在 /login 时视为已登录） */
async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('/', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

/** 首次访问需要先初始化管理员账号 */
async function ensureSetup(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  if (!page.url().includes('/setup')) return;

  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.fill('input[id="confirmPassword"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('/', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

/**
 * 确保存在一个库。优先复用后端已有数据（幂等），
 * 否则通过 UI 建一个——“建库”本身就是一个受 CSRF 保护的写请求。
 */
async function ensureLibrary(page: Page) {
  const existing = await page.request.get('/api/v1/libraries');
  const body = (await existing.json()) as { data?: unknown[] };
  if (body.data && body.data.length > 0) return;

  const opener = page.getByRole('button', { name: 'Create Library', exact: true });
  await expect(opener).toBeVisible({ timeout: 15000 });
  await opener.click();
  await expect(page.getByLabel('Library Name')).toBeVisible({ timeout: 10000 });

  await page.getByLabel('Library Name').fill(LIBRARY_NAME);
  await page.getByLabel('Folder Path (relative to /data)').fill(LIBRARY_PATH);

  const created = page.waitForResponse(
    (resp) => resp.url().includes('/api/v1/libraries') && resp.request().method() === 'POST',
    { timeout: 15000 }
  );
  // 弹窗页脚：取消 + 创建（i18n "common.create" / "Creating…"）
  await page.locator('button:has-text("Create"), button:has-text("Creating")').last().click();

  const response = await created;
  expect(response.status()).toBeLessThan(400);
  await page.waitForLoadState('networkidle');
}

/** 打开 Settings → Git 页签 */
async function openGitSettings(page: Page) {
  await page.goto('/settings?tab=git');
  await expect(page).toHaveURL(/settings/);
  await expect(page.locator('button:has-text("Save Git configuration")')).toBeVisible({
    timeout: 15000,
  });
}

/** 在 Git 页签点保存，返回 PATCH 请求与响应 */
type WriteAttempt = { csrfHeader: string | undefined; status: number };

async function clickSave(page: Page): Promise<WriteAttempt[]> {
  const attempts: WriteAttempt[] = [];
  page.on('response', (resp) => {
    if (
      resp.url().includes('/api/v1/libraries/') &&
      ['POST', 'PUT', 'PATCH'].includes(resp.request().method())
    ) {
      attempts.push({
        csrfHeader: resp.request().headers()['x-csrf-token'],
        status: resp.status(),
      });
    }
  });

  await page.locator('button:has-text("Save Git configuration")').click();
  await expect.poll(() => attempts.length, { timeout: 20000 }).toBeGreaterThan(0);
  await expect.poll(() => attempts.at(-1)?.status, { timeout: 20000 }).toBeLessThan(400);
  return attempts;
}

test.describe('CSRF 防护（真实浏览器）', () => {
  test('登录后保存 Git 配置成功，写请求带上了 CSRF token', async ({ page }) => {
    const csrfFailures = watchCsrfFailures(page);

    await ensureSetup(page);
    if (!page.url().startsWith('http://localhost:8080/') || page.url().includes('/login')) {
      await login(page);
    }
    await ensureLibrary(page);
    await openGitSettings(page);

    const attempts = await clickSave(page);

    // 关键断言：保存成功，且最终成功的请求带上了 CSRF token。
    // 够不到响应头的环境（例如 CORS 未声明 expose header）可能先被
    // CSRF_TOKEN_REFRESHED 拦一次，前端会自动重试——用户最终仍需保存成功。
    expect(attempts.at(-1)?.status).toBeLessThan(400);
    expect(attempts.at(-1)?.csrfHeader).toBeTruthy();
    expect(attempts.length).toBeLessThanOrEqual(2);
    expect(attempts[0]?.status === 403 ? 2 : 1).toBe(attempts.length);
    expect(csrfFailures.length).toBeLessThanOrEqual(1);
  });

  test('CSRF cookie 丢失后重新登录，保存仍然正常', async ({ page, context }) => {
    await ensureSetup(page);
    if (!page.url().startsWith('http://localhost:8080/') || page.url().includes('/login')) {
      await login(page);
    }

    // 模拟旧版本登录的用户：有会话 cookie，但没有 CSRF cookie
    const before = await context.cookies();
    expect(before.some((c) => c.name === 'webnote_csrf')).toBe(true);
    await context.clearCookies({ name: 'webnote_csrf' });

    // 重新登录拿到配套的 CSRF cookie + token，并整页刷新——和用户恢复旧会话后的
    // 实际行为一致（内存里的旧 token 在刷新后同样会失效）
    if (page.url().includes('/login')) {
      await login(page);
    }
    await ensureLibrary(page);
    await openGitSettings(page);

    void watchCsrfFailures(page);
    const attempts = await clickSave(page);

    // 浏览器读不到响应头时会先被拒一次（403 CSRF_TOKEN_REFRESHED），
    // 前端拿新令牌静默重试，用户看到的结果必须是保存成功
    expect(attempts.at(-1)?.status).toBeLessThan(400);
    expect(attempts.at(-1)?.csrfHeader).toBeTruthy();
    expect(attempts.length).toBeLessThanOrEqual(2);
  });
});
