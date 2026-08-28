import { expect, test } from '@playwright/test';

async function expectNoHorizontalOverflow(page) {
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  )).toBe(true);
}

async function waitForPortfolio(page) {
  await expect(page.locator('body')).toHaveClass(/portfolio-ready/);
}

test('landing page exposes its primary actions and language switch', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#main-title')).toHaveText(/ARTUR ARAUJO/i);
  await expect(page.locator('#enter-button')).toBeVisible();
  await expect(page.locator('#watch-reel-button')).toBeVisible();
  await expect(page.locator('.site-language-toggle')).toHaveText('EN');
  await expectNoHorizontalOverflow(page);
});

test('language switch persists and remains exclusive to the landing page', async ({ page }) => {
  await page.goto('/');
  await page.locator('.site-language-toggle').click();
  await expect(page.locator('.site-language-toggle')).toHaveText('BR');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.goto('/work');
  await waitForPortfolio(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('.site-language-toggle')).toHaveCount(0);
});

test('enter opens the clean work route with the overview ready', async ({ page }) => {
  await page.goto('/');
  await page.locator('#enter-button').click();
  await expect(page).toHaveURL(/\/work$/);
  await waitForPortfolio(page);
  await expect(page.locator('#portfolio-overview-view')).toBeVisible();
  await expect(page.locator('#work-section-index .work-section-link').first()).toBeVisible();
});

test('section navigation preserves the document shell and resets scroll', async ({ page }) => {
  await page.goto('/work');
  await waitForPortfolio(page);
  await page.evaluate(() => { window.__portfolioShellSentinel = 'mounted'; });

  const firstSection = page.locator('#work-section-index .work-section-link').first();
  const expectedPath = new URL(await firstSection.getAttribute('href'), page.url()).pathname;
  await firstSection.click();

  await expect(page).toHaveURL(new RegExp(`${expectedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  await expect(page.locator('.section-title')).not.toHaveText('');
  await expect.poll(() => page.evaluate(() => window.__portfolioShellSentinel)).toBe('mounted');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test('a gallery project opens a populated clean project route and can return', async ({ page }) => {
  await page.goto('/featured-work');
  await waitForPortfolio(page);
  const firstProject = page.locator('.project-link').first();
  await expect(firstProject).toBeVisible();
  const expectedTitle = await firstProject.locator('.frame-title').textContent();
  await firstProject.click();

  await expect(page).toHaveURL(/\/project\/[^/?#]+$/);
  await expect(page.locator('body')).toHaveClass(/project-data-ready/);
  await expect(page.locator('#project-detail-title')).toHaveText(expectedTitle.trim());
  await expect(page.locator('#project-back-link')).toBeVisible();
  await page.locator('#project-back-link').click();
  await expect(page).toHaveURL(/\/featured-work$/);
});

test('contact form validates locally without sending an empty request', async ({ page }) => {
  let contactRequests = 0;
  page.on('request', request => {
    if (request.url().includes('/functions/v1/send-contact-email')) contactRequests += 1;
  });
  await page.goto('/contact');
  await page.locator('#contact-form [type="submit"]').click();
  await expect(page.locator('#name')).toBeFocused();
  expect(contactRequests).toBe(0);
  await expectNoHorizontalOverflow(page);
});

test('unknown clean routes render the custom 404 page', async ({ page }) => {
  const response = await page.goto('/this-route-does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(page.locator('main h1')).toContainText(/NÃO ENCONTRADA|NOT FOUND/);
});

test.describe('mobile navigation', () => {
  test.skip(({ isMobile }) => !isMobile, 'Mobile-only behavior');

  test('hamburger opens a full menu, traps focus and closes after navigation', async ({ page }) => {
    await page.goto('/featured-work');
    await waitForPortfolio(page);
    const toggle = page.locator('#nav-toggle');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#nav-menu')).toHaveClass(/open/);
    await expect(page.locator('html')).toHaveClass(/mobile-menu-open/);
    await expect(page.locator('#nav-menu a').first()).toBeFocused();
    await expectNoHorizontalOverflow(page);

    await page.locator('#nav-menu a').first().click();
    await expect(page).toHaveURL(/\/work$/);
    await expect(page.locator('#nav-menu')).not.toHaveClass(/open/);
  });
});
