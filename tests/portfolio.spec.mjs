import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function expectNoHorizontalOverflow(page) {
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  )).toBe(true);
}

async function waitForPortfolio(page) {
  await expect(page.locator('body')).toHaveClass(/portfolio-ready/);
}

async function expectNoCspViolations(page) {
  await page.waitForTimeout(50);
  const violations = await page.evaluate(() => window.__portfolioCspViolations || []);
  expect(violations, `CSP violations: ${JSON.stringify(violations)}`).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__portfolioCspViolations = [];
    document.addEventListener('securitypolicyviolation', event => {
      window.__portfolioCspViolations.push({
        directive: event.effectiveDirective,
        blocked: event.blockedURI
      });
    });
  });
});

test.afterEach(async ({ page }) => {
  if (!page.isClosed()) await expectNoCspViolations(page);
});

test('landing page exposes its primary actions and language switch', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#main-title')).toHaveText(/ARTUR ARAUJO/i);
  await expect(page.locator('#enter-button')).toBeVisible();
  await expect(page.locator('#watch-reel-button')).toBeVisible();
  await expect(page.locator('.site-language-toggle')).toHaveText('EN');
  await expect(page).toHaveTitle(/ARTUR ARAUJO/i);
  await expectNoHorizontalOverflow(page);
});

test('mobile reel loads its vertical source only on demand and contains the desktop fallback', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'This behavior is exclusive to the mobile viewport');
  await page.goto('/');
  await expect(page.locator('body')).toHaveClass(/site-settings-ready/);
  const mobileReel = page.locator('#mobile-reel-video');
  await expect(mobileReel).not.toHaveAttribute('src');

  await page.evaluate(() => {
    window.siteSettings.apply({
      ...window.siteSettings.loadLocal(),
      landingMobileReelVideo: 'assets/videos/bg-cinema.mp4'
    });
  });
  await expect(mobileReel).not.toHaveAttribute('src');
  await page.locator('#watch-reel-button').click();
  await expect(page.locator('body')).toHaveClass(/landing-reel-mobile-source/);
  await expect(mobileReel).toHaveAttribute('src', 'assets/videos/bg-cinema.mp4');
  await expect(page.locator('body')).toHaveClass(/landing-reel-mobile-source-ready/);
  expect(await mobileReel.evaluate(element => getComputedStyle(element).objectFit)).toBe('cover');

  await page.locator('#landing-reel-close').click();
  await page.evaluate(() => {
    window.siteSettings.apply({
      ...window.siteSettings.loadLocal(),
      landingMobileReelVideo: ''
    });
  });
  await page.locator('#watch-reel-button').click();
  await expect(page.locator('body')).not.toHaveClass(/landing-reel-mobile-source/);
  expect(await page.locator('#bg-video').evaluate(element => getComputedStyle(element).objectFit)).toBe('contain');
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

test('a custom browser title does not alter the visible landing heading', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The settings behavior only needs one browser project');
  await page.goto('/');
  await expect(page.locator('body')).toHaveClass(/site-settings-ready/);
  const visibleHeading = await page.locator('#main-title').textContent();
  await page.evaluate(() => {
    window.siteSettings.apply({
      ...window.siteSettings.loadLocal(),
      landingBrowserTitle: 'CUSTOM PORTFOLIO TAB'
    });
  });
  await expect(page).toHaveTitle('CUSTOM PORTFOLIO TAB');
  await expect(page.locator('#main-title')).toHaveText(visibleHeading.trim());
});

test('enter opens the clean work route with the overview ready', async ({ page }) => {
  await page.goto('/');
  await page.locator('#enter-button').click();
  await expect(page).toHaveURL(/\/work$/);
  await waitForPortfolio(page);
  await expect(page.locator('#portfolio-overview-view')).toBeVisible();
  await expect(page.locator('#work-section-index .work-section-link').first()).toBeVisible();
  expect(await page.title()).not.toBe('ARTUR ARAUJO | Portfolio');
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

test('section URL slugs resolve independently from stable internal IDs', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Route resolution only needs one browser project');
  await page.goto('/work');
  await waitForPortfolio(page);
  const resolved = await page.evaluate(() => resolvePublishedGallery([{
    id: 'section-stable-id',
    slug: 'current-url',
    previousSlugs: ['old-url'],
    title: 'TEST SECTION',
    published: true
  }], 'old-url'));
  expect(resolved.id).toBe('section-stable-id');
  expect(resolved.slug).toBe('current-url');
});

test('admin full backup includes the complete content model and deduplicated media', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Backup serialization only needs one browser project');
  await page.goto('/admin');
  const backup = await page.evaluate(() => window.adminStorage.createFullBackup(
    [{ id: 'section-id', slug: 'section-url', title: 'SECTION', order: 1, published: true }],
    [{
      id: 'project-id', slug: 'project-url', title: 'PROJECT', section: 'section-id',
      size: '16-9', order: 1, published: true, coverImage: 'https://media.example/cover.jpg',
      projectStills: [{ url: 'https://media.example/cover.jpg', size: '16-9' }]
    }],
    {
      landingTitle: 'ARTUR ARAUJO',
      landingBackgroundVideo: 'assets/videos/bg-cinema.mp4',
      landingMobileReelVideo: 'https://media.example/mobile-reel.mp4'
    }
  ));

  expect(backup.backupType).toBe('artur-portfolio-full');
  expect(backup.galleries).toHaveLength(1);
  expect(backup.projects).toHaveLength(1);
  expect(backup.settings.landingTitle).toBe('ARTUR ARAUJO');
  expect(backup.media).toHaveLength(3);
  expect(backup.media.find(item => item.url.includes('cover.jpg')).references).toHaveLength(2);
  expect(await page.evaluate(value => window.adminStorage.validateFullBackup(value), backup)).toEqual([]);
});

test('a gallery project opens a populated clean project route and can return', async ({ page }) => {
  await page.goto('/featured-work');
  await waitForPortfolio(page);
  const expectedBackPath = new URL(page.url()).pathname;
  const firstProject = page.locator('.project-link').first();
  await expect(firstProject).toBeVisible();
  const expectedTitle = await firstProject.locator('.frame-title').textContent();
  await firstProject.click();

  await expect(page).toHaveURL(/\/project\/[^/?#]+$/);
  await expect(page.locator('body')).toHaveClass(/project-data-ready/);
  await expect(page.locator('#project-detail-title')).toHaveText(expectedTitle.trim());
  expect(await page.title()).not.toBe('ARTUR ARAUJO | Project');
  await expect(page.locator('#project-back-link')).toBeVisible();
  const youtubeCover = page.locator('.project-youtube-cover');
  if (await youtubeCover.count()) {
    await youtubeCover.click();
    await expect(page.locator('.project-video-modal iframe')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.project-video-modal')).toHaveCount(0);
  }
  await page.locator('#project-back-link').click();
  await expect(page).toHaveURL(new RegExp(`${expectedBackPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
});

test('a project without YouTube keeps the same hero frame without a play control', async ({ page }) => {
  await page.goto('/featured-work');
  await waitForPortfolio(page);
  await page.locator('.project-link').first().click();
  await expect(page.locator('body')).toHaveClass(/project-data-ready/);

  const frames = await page.evaluate(() => {
    const sharedProject = {
      title: 'STATIC COVER TEST',
      size: '9-16',
      coverImage: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
      previewVideo: '',
      desktopFocusX: 50,
      desktopFocusY: 50,
      desktopCoverScale: 100,
      mobileFocusX: 50,
      mobileFocusY: 50,
      mobileCoverScale: 100
    };

    renderProjectDetailMedia({
      ...sharedProject,
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    });
    const youtubeFrame = document.querySelector('#project-detail-media').getBoundingClientRect();

    renderProjectDetailMedia({ ...sharedProject, youtubeUrl: '' });
    const staticContainer = document.querySelector('#project-detail-media');
    const staticFrame = staticContainer.getBoundingClientRect();

    return {
      youtubeWidth: youtubeFrame.width,
      youtubeHeight: youtubeFrame.height,
      staticWidth: staticFrame.width,
      staticHeight: staticFrame.height,
      className: staticContainer.className,
      playControls: staticContainer.querySelectorAll('.project-youtube-cover, .project-play-icon').length
    };
  });

  expect(frames.className).toContain('detail-ratio-16-9');
  expect(frames.playControls).toBe(0);
  expect(frames.staticWidth).toBeCloseTo(frames.youtubeWidth, 1);
  expect(frames.staticHeight).toBeCloseTo(frames.youtubeHeight, 1);
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

test('legacy featured-work URL permanently redirects to the current section slug', async ({ request, isMobile }) => {
  test.skip(isMobile, 'Redirect behavior only needs one browser project');
  const response = await request.get('/featured-work', { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers().location).toBe('/work/film-tv-streaming');
});

test('generated sitemap and project HTML expose crawlable production metadata', async ({ request, isMobile }) => {
  test.skip(isMobile, 'Build metadata only needs one browser project');
  const sitemapResponse = await request.get('/sitemap.xml');
  expect(sitemapResponse.ok()).toBeTruthy();
  const sitemap = await sitemapResponse.text();
  expect(sitemap).toContain('https://arturaraujo.com/work');
  expect(sitemap).toContain('https://arturaraujo.com/work/film-tv-streaming');
  expect(sitemap).not.toContain('https://arturaraujo.com/featured-work');
  const projectMatch = sitemap.match(/https:\/\/arturaraujo\.com(\/project\/[^<]+)/);
  expect(projectMatch).toBeTruthy();

  const projectResponse = await request.get(projectMatch[1]);
  expect(projectResponse.ok()).toBeTruthy();
  const projectHtml = await projectResponse.text();
  expect(projectHtml).toMatch(/<title>(?!ARTUR ARAUJO \| Project)[^<]+<\/title>/);
  expect(projectHtml).toContain(`<link rel="canonical" href="https://arturaraujo.com${projectMatch[1]}">`);
  expect(projectHtml).toMatch(/<meta property="og:image" content="https:\/\//);

  const legacyAliasHtml = await readFile(new URL('../dist/featured-work.html', import.meta.url), 'utf8');
  expect(legacyAliasHtml).toContain('<meta name="robots" content="noindex, follow">');
  expect(legacyAliasHtml).toContain('<link rel="canonical" href="https://arturaraujo.com/work/film-tv-streaming">');
  expect(legacyAliasHtml).toContain('<meta http-equiv="refresh" content="0; url=/work/film-tv-streaming">');
});

test('security headers protect the public document without blocking its scripts', async ({ page, request, isMobile }) => {
  test.skip(isMobile, 'Header behavior only needs one browser project');
  const response = await request.get('/work');
  const csp = response.headers()['content-security-policy'];
  expect(csp).toContain("script-src 'self' https://cdn.jsdelivr.net");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("frame-ancestors 'none'");

  await page.goto('/admin');
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('link[href*="admin/admin.css"]')).toHaveCount(1);
  await expect(page.locator('#btn-deploy-seo')).toHaveText('Update SEO & Previews');
  await expect(page.locator('.admin-menu-note', { hasText: 'Saved Supabase content is already live' }))
    .toContainText('Saved Supabase content is already live');
  const adminScript = await (await request.get('/admin/admin.js')).text();
  expect(adminScript).toContain('setting-landingBrowserTitle');
  expect(adminScript).toContain('setting-workBrowserTitle');
  expect(adminScript).toContain('setting-contactBrowserTitle');
  expect(adminScript).toContain('field-browserTitle');
  expect(adminScript).toContain('gallery-browser-title');
  expect(adminScript).toContain('Internal ID');
  expect(adminScript).toContain('URL Slug');
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
