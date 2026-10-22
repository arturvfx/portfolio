import {test, expect} from '@playwright/test';

test.beforeEach(async ({page}) => {
  await page.route('**/data/projects-data.js*', route => route.fulfill({
    contentType:'application/javascript', body:'const PROJECTS_DATA = [{id:"fixture",slug:"fixture",title:"Fixture project",section:"featured-work",order:1,size:"16-9",published:true}];'
  }));
  await page.route('**/config/supabase-config.js*', route => route.fulfill({
    contentType: 'application/javascript', body: 'window.SUPABASE_CONFIG = {};'
  }));
  await page.goto('/admin');
});

test('workspace preserves unsaved content across tabs, framing contexts and locales', async ({page}) => {
  await page.locator('#btn-new-project').click();
  await page.locator('#field-title').fill('Workspace regression');
  await page.getByRole('tab', {name:'Media', exact:true}).click();
  await expect(page.locator('#field-title')).toBeHidden();
  await page.locator('.visual-asset').filter({has:page.locator('#field-coverImage')}).getByText('Use or edit a link', {exact:true}).click();
  await page.locator('#field-coverImage').fill('/assets/images/test.webp');
  await page.locator('#field-desktopFocusX').fill('17');
  await page.locator('#frame-surface').selectOption('project');
  await page.locator('#frame-device').selectOption('mobile');
  await page.locator('#field-projectMobileFocusX').fill('71');
  await page.getByRole('tab', {name:'Publication', exact:true}).click();
  await page.locator('#field-published').selectOption('false');
  await page.getByRole('tab', {name:'Content', exact:true}).click();
  await expect(page.locator('#field-title')).toHaveValue('Workspace regression');
  await page.locator('[data-admin-locale="en"]').click();
  await page.locator('#field-title').fill('Workspace English');
  await page.locator('[data-admin-locale="pt-BR"]').click();
  await expect(page.locator('#field-title')).toHaveValue('Workspace regression');
  await page.locator('#btn-save').click();
  const saved = await page.evaluate(() => adminStorage.load().projects.find(p => p.title === 'Workspace regression'));
  expect(saved).toMatchObject({published:false,desktopFocusX:17,projectMobileFocusX:71,coverImage:'/assets/images/test.webp'});
  expect(saved.translations.en.title).toBe('Workspace English');
  await page.locator('#project-search').fill('Workspace regression');
  await expect(page.locator('.project-list-item')).toHaveCount(1);
  await expect(page.locator('.project-drag-handle')).toHaveCount(0);
  await page.locator('#project-visibility').selectOption('published');
  await expect(page.locator('.project-list-item')).toHaveCount(0);
  await page.locator('#project-search').fill('');
  await page.locator('#project-visibility').selectOption('all');
  expect(await page.locator('.project-drag-handle').count()).toBeGreaterThan(0);
});

test('tabs support keyboard navigation and do not dirty the form', async ({page}) => {
  await page.locator('.project-list-item').first().click();
  const content = page.getByRole('tab', {name:'Content', exact:true});
  await content.focus();
  await content.press('ArrowRight');
  await expect(page.getByRole('tab', {name:'Media', exact:true})).toBeFocused();
  await expect(page.locator('#dirty-hint')).toBeHidden();
  await page.locator('#frame-surface').selectOption('featured');
  await page.locator('#frame-device').selectOption('mobile');
  await expect(page.locator('#dirty-hint')).toBeHidden();
  await page.screenshot({path: test.info().outputPath('workspace-media.png'), fullPage:true});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('settings retain values when switching sections', async ({page}) => {
  await page.locator('#btn-site-settings').click();
  await page.locator('#setting-landingTitle').fill('Workspace title');
  await page.getByRole('tab', {name:'Footer', exact:true}).click();
  await expect(page.locator('#setting-landingTitle')).toBeHidden();
  await page.locator('#setting-footerCopyright').fill('Workspace copyright');
  await page.locator('#btn-save-site-settings').click();
  const saved = await page.evaluate(() => siteSettings.loadLocal());
  expect(saved.landingTitle).toBe('Workspace title');
  expect(saved.footerCopyright).toBe('Workspace copyright');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({path: test.info().outputPath('workspace-settings.png'), fullPage:true});
});

test('validation reveals the tab containing the invalid field', async ({page}) => {
  await page.locator('.project-list-item').first().click();
  await page.locator('#field-title').fill('');
  await page.getByRole('tab', {name:'Publication', exact:true}).click();
  await page.locator('#btn-save').click();
  await expect(page.getByRole('tab', {name:'Content', exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.locator('#field-title')).toBeFocused();
});

test('visual still gallery adds, frames, removes and saves images without losing other slots', async ({page}) => {
  await page.locator('.project-list-item').first().click();
  await page.getByRole('tab', {name:'Media',exact:true}).click();
  await expect(page.locator('.project-still-slot:visible')).toHaveCount(0);
  const image = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  for (let i=0;i<3;i++) {
    await page.getByRole('button',{name:'＋ Add image',exact:true}).click();
    const slot = page.locator('.project-still-slot').nth(i);
    await slot.getByText('Use or edit image link',{exact:true}).click();
    await slot.locator('[data-still-url]').fill(image + '#' + i);
    await expect(slot.locator('.project-still-preview img')).toHaveAttribute('src',image + '#' + i);
    await slot.locator('[data-still-size]').selectOption('9-16');
    await expect(slot.locator('.project-still-preview')).toHaveCSS('aspect-ratio','9 / 16');
  }
  await expect(page.getByRole('button',{name:'＋ Add image',exact:true})).toBeHidden();
  await page.getByRole('button',{name:'Edit image 2',exact:true}).click();
  await page.locator('#btn-clear-projectStill-1').click();
  await expect(page.locator('.project-still-slot:visible')).toHaveCount(2);
  await page.locator('#btn-save').click();
  const saved = await page.evaluate(() => adminStorage.load().projects.find(p => p.id === 'fixture'));
  expect(saved.projectStills).toEqual([{url:image+'#0',size:'9-16'},{url:image+'#2',size:'9-16'}]);
  await page.screenshot({path:test.info().outputPath('visual-media.png'),fullPage:true});
});

test('video previews load on request and stop when leaving media without dirtying data', async ({page}) => {
  await page.route('https://player.vimeo.com/**', route => route.fulfill({contentType:'text/html',body:'Mock player'}));
  await page.locator('.project-list-item').first().click();
  await page.getByRole('tab',{name:'Media',exact:true}).click();
  const asset = page.locator('.visual-asset').filter({has:page.locator('#field-youtubeUrl')});
  await asset.getByText('Use or edit a link',{exact:true}).click();
  await page.locator('#field-youtubeUrl').fill('https://vimeo.com/123456');
  await expect(asset.getByRole('button',{name:'▶ Preview vimeo',exact:true})).toBeVisible();
  await expect(asset.locator('iframe')).toHaveCount(0);
  await page.locator('#btn-save').click();
  await asset.getByRole('button',{name:'▶ Preview vimeo',exact:true}).click();
  await expect(asset.locator('iframe')).toHaveCount(1);
  await page.getByRole('tab',{name:'Content',exact:true}).click();
  await expect(asset.locator('iframe')).toHaveCount(0);
  await expect(page.locator('#dirty-hint')).not.toContainText('Unsaved');
});
