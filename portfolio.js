/**
 * portfolio.js
 *
 * Portfolio System Orchestration Layer.
 * Responsibility: Identify the current page, retrieve its configuration,
 * update the DOM accordingly, and initialize the project gallery.
 *
 * This is the only file that wires data, config and components together.
 *
 * Dependencies (must be loaded before this file in this order):
 *   1. data/projects-data.js        → PROJECTS_DATA
 *   2. config/page-configs.js       → GALLERIES_DATA, galleryToPageConfig
 *   3. components/project-frame.js  → renderProjectFrame
 *   4. components/project-gallery.js → renderProjectGallery
 *   5. admin/admin-storage.js       → adminStorage (optional — for local fallback support)
 *   6. data/supabase-service.js     → portfolioBackend (optional — primary public source)
 */

/**
 * Render a complete portfolio page from a page configuration object.
 *
 * @param {Object} pageConfig - Effective configuration for the active section
 * @param {Array} projects - Effective projects from Supabase or the local fallback
 */
function renderPortfolioPage(pageConfig, projects) {
  if (!pageConfig) return;

  document.body.classList.remove('portfolio-overview');
  document.body.classList.add('portfolio-section');
  const sectionView = document.getElementById('portfolio-section-view');
  const overviewView = document.getElementById('portfolio-overview-view');
  if (sectionView) sectionView.hidden = false;
  if (overviewView) overviewView.hidden = true;

  // 1. Update Section Title
  const titleEl = document.querySelector('.section-title');
  if (titleEl && pageConfig.title) {
    titleEl.textContent = pageConfig.title;
    titleEl.setAttribute('data-text', pageConfig.title);
  }

  // 2. Update Section Description (show or hide)
  const subEl = document.querySelector('.section-subtitle');
  if (subEl) {
    if (pageConfig.description) {
      subEl.textContent = pageConfig.description;
      subEl.style.display = 'block';
    } else {
      subEl.style.display = 'none';
    }
  }

  // 3. Update Navigation Active State
  if (pageConfig.activeNav) {
    document.querySelectorAll('.nav-link').forEach(link => {
      if (link.getAttribute('data-section') === pageConfig.activeNav) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
      }
    });
  }

  // 4. Section pages start directly with their project grid. The editorial
  // hero belongs exclusively to the global /work overview.
  const heroContainer = document.getElementById('section-featured-hero');
  if (typeof renderSectionHero === 'function') {
    renderSectionHero([], heroContainer);
  }

  // 5. Mount Project Gallery
  const containerId = pageConfig.containerId || 'project-gallery';
  const container = document.getElementById(containerId) ||
    document.querySelector('.portfolio-grid[data-page]');

  if (container) {
    container.hidden = false;
    renderProjectGallery(projects, container, pageConfig);
  }
}

let publicPortfolioRuntime = null;
let activePortfolioGallery = null;
let activePortfolioView = null;

function getCurrentWorkSettings() {
  return (window.siteSettings?.getCurrent ? siteSettings.getCurrent() : siteSettings?.loadLocal?.()) || {};
}

function updatePortfolioOverviewMetadata(settings) {
  const title = `ARTUR ARAUJO | ${window.portfolioI18n?.t('selectedWork') || 'TRABALHOS SELECIONADOS'}`;
  const description = settings.workIntroBody || settings.workIntroTitle ||
    (window.portfolioI18n?.getLocale() === 'en'
      ? 'Selected VFX, motion and editorial work by Artur Araujo.'
      : 'Seleção de trabalhos de VFX, motion e edição de Artur Araujo.');
  document.title = title;
  setPortfolioMeta('meta[name="description"]', description);
  setPortfolioMeta('meta[property="og:title"]', title);
  setPortfolioMeta('meta[property="og:description"]', description);
  const canonicalUrl = getCanonicalPortfolioOverviewUrl();
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonicalUrl);
  setPortfolioMeta('meta[property="og:url"]', canonicalUrl);
}

function renderPortfolioOverview(settings, projects, galleries) {
  const normalizedRawSettings = window.siteSettings
    ? siteSettings.normalize(settings)
    : settings || {};
  const normalizedSettings = window.portfolioI18n
    ? portfolioI18n.localizeSettings(normalizedRawSettings)
    : normalizedRawSettings;
  const sectionView = document.getElementById('portfolio-section-view');
  const overviewView = document.getElementById('portfolio-overview-view');
  const container = document.getElementById('project-gallery');
  const heroContainer = document.getElementById('section-featured-hero');

  document.body.classList.add('portfolio-overview');
  document.body.classList.remove('portfolio-section');
  if (sectionView) sectionView.hidden = true;
  if (overviewView) overviewView.hidden = false;
  if (container) {
    if (typeof destroyProjectGalleryMasonry === 'function') destroyProjectGalleryMasonry(container);
    container.replaceChildren();
    container.hidden = true;
    container.setAttribute('data-page', 'work');
  }

  const heroProjects = typeof selectWorkHeroProjects === 'function'
    ? selectWorkHeroProjects(projects, normalizedSettings)
    : [];
  if (typeof renderSectionHero === 'function') {
    renderSectionHero(heroProjects, heroContainer, {
      galleryTitle: window.portfolioI18n?.t('selectedWork') || 'TRABALHOS SELECIONADOS',
      hasRemainingProjects: true,
      downLabel: window.portfolioI18n?.t('viewWorkSections') || 'Ver apresentação e categorias do portfólio',
      previewSourceHref: getPortfolioOverviewHref(),
      previewSourceLabel: window.portfolioI18n?.getLocale() === 'en' ? 'WORK' : 'TRABALHOS'
    });
  }

  const intro = document.getElementById('work-overview-intro');
  const introTitle = document.getElementById('work-overview-title');
  const introBody = document.getElementById('work-overview-body');
  if (introTitle) introTitle.textContent = normalizedSettings.workIntroTitle || '';
  if (introBody) introBody.textContent = normalizedSettings.workIntroBody || '';
  if (introTitle) introTitle.hidden = !normalizedSettings.workIntroTitle;
  if (introBody) introBody.hidden = !normalizedSettings.workIntroBody;
  if (intro) intro.hidden = !normalizedSettings.workIntroTitle && !normalizedSettings.workIntroBody;

  const sectionIndex = document.getElementById('work-section-index');
  if (sectionIndex) {
    sectionIndex.replaceChildren();
    galleries
      .filter(gallery => gallery.published !== false)
      .sort((a, b) => Number(a.order) - Number(b.order))
      .forEach(gallery => {
        const link = document.createElement('a');
        link.className = 'work-section-link';
        link.href = getGalleryHref(gallery.id);
        link.setAttribute('data-section', gallery.id);
        link.addEventListener('click', event => {
          if (!publicPortfolioRuntime) return;
          event.preventDefault();
          navigatePortfolioSection(gallery.id, { history: 'push', scroll: true });
        });

        const heading = document.createElement('span');
        heading.className = 'work-section-title';
        heading.textContent = gallery.title;
        const arrow = document.createElement('span');
        arrow.className = 'work-section-arrow';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = '↓';
        link.append(heading, arrow);
        sectionIndex.appendChild(link);
      });
  }

  document.querySelectorAll('.nav-link').forEach(link => {
    const isOverviewLink = link.getAttribute('data-view') === 'overview';
    link.classList.toggle('active', isOverviewLink);
    if (isOverviewLink) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  updatePortfolioOverviewMetadata(normalizedSettings);
}

function resolveGalleryBackgroundUrl(gallery, settings) {
  if (gallery.backgroundSource === 'homepage') return settings.landingBackgroundVideo;
  if (gallery.backgroundSource === 'custom' && gallery.backgroundVideo) return gallery.backgroundVideo;
  return settings.galleryBackgroundVideo;
}

function applyGalleryBackground(gallery, settingsOverride) {
  const wrapper = document.querySelector('.video-background-wrapper');
  const video = document.getElementById('bg-video');
  const source = video?.querySelector('[data-site-setting="gallery-background-video"]');
  if (!wrapper || !video || !source || !gallery) return;

  activePortfolioGallery = gallery;
  document.body.classList.add('gallery-background-managed');
  const enabled = gallery.backgroundEnabled !== false;
  document.body.classList.toggle('gallery-solid-background', !enabled);
  wrapper.setAttribute('aria-hidden', 'true');

  if (!enabled) {
    video.pause();
    return;
  }

  const settings = settingsOverride ||
    (window.siteSettings?.getCurrent ? siteSettings.getCurrent() : siteSettings?.loadLocal?.()) || {};
  const nextUrl = resolveGalleryBackgroundUrl(gallery, settings);
  if (!nextUrl) return;
  if (source.getAttribute('src') !== nextUrl) {
    source.setAttribute('src', nextUrl);
    source.setAttribute('type', nextUrl.toLowerCase().split('?')[0].endsWith('.webm')
      ? 'video/webm'
      : 'video/mp4');
    video.load();
  }
  const hero = document.getElementById('section-featured-hero');
  const heroRect = hero && !hero.hidden ? hero.getBoundingClientRect() : null;
  const heroCoversViewport = heroRect &&
    heroRect.top < window.innerHeight * 0.5 &&
    heroRect.bottom > window.innerHeight * 0.5;
  if (heroCoversViewport) {
    video.pause();
    return;
  }
  const playback = video.play();
  if (playback?.catch) playback.catch(() => {});
}

function resolvePublishedGallery(galleries, requestedId) {
  return galleries.find(item => item.id === requestedId && item.published !== false) ||
    galleries.find(item => item.published !== false) ||
    { id: requestedId, title: requestedId.replace(/-/g, ' '), published: true, order: 1 };
}

function setPortfolioMeta(selector, value) {
  const element = document.querySelector(selector);
  if (element && value) element.setAttribute('content', value);
}

function updateGalleryMetadata(gallery) {
  const title = `ARTUR ARAUJO | ${gallery.title}`;
  const description = gallery.description ||
    (window.portfolioI18n?.getLocale() === 'en'
      ? `Selected ${gallery.title.toLowerCase()} projects by VFX generalist Artur Araujo.`
      : `Projetos selecionados de ${gallery.title.toLowerCase()} por Artur Araujo.`);
  document.title = title;
  setPortfolioMeta('meta[name="description"]', description);
  setPortfolioMeta('meta[property="og:title"]', title);
  setPortfolioMeta('meta[property="og:description"]', description);
  const canonicalUrl = getCanonicalGalleryUrl(gallery.id);
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonicalUrl);
  setPortfolioMeta('meta[property="og:url"]', canonicalUrl);
}

/**
 * Replace only the active gallery content. The surrounding document shell
 * (navigation, background and footer) deliberately remains mounted.
 */
function navigatePortfolioSection(sectionId, options = {}) {
  if (!publicPortfolioRuntime) return false;
  const container = document.getElementById('project-gallery') ||
    document.querySelector('.portfolio-grid[data-page]');
  if (!container) return false;

  const gallery = resolvePublishedGallery(publicPortfolioRuntime.galleries, sectionId);
  const pageConfig = typeof galleryToPageConfig === 'function'
    ? galleryToPageConfig(gallery)
    : { ...gallery, projectSection: gallery.id, activeNav: gallery.id, containerId: 'project-gallery' };

  container.setAttribute('data-page', gallery.id);
  activePortfolioView = 'section';
  updateGalleryMetadata(gallery);
  renderPortfolioPage(pageConfig, publicPortfolioRuntime.projects);
  applyGalleryBackground(gallery);

  if (options.history === 'push' || options.history === 'replace') {
    const method = options.history === 'replace' ? 'replaceState' : 'pushState';
    window.history[method]({ portfolioSection: gallery.id }, '', getGalleryHref(gallery.id));
  }

  const menu = document.getElementById('nav-menu');
  if (menu) menu.classList.remove('open');
  if (options.scroll !== false) window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  return true;
}

function navigatePortfolioOverview(options = {}) {
  if (!publicPortfolioRuntime) return false;
  activePortfolioView = 'overview';
  renderPortfolioOverview(
    getCurrentWorkSettings(),
    publicPortfolioRuntime.projects,
    publicPortfolioRuntime.galleries
  );
  applyGalleryBackground({ id: 'work', backgroundEnabled: false });

  if (options.history === 'push' || options.history === 'replace') {
    const method = options.history === 'replace' ? 'replaceState' : 'pushState';
    window.history[method]({ portfolioView: 'overview' }, '', getPortfolioOverviewHref());
  }

  const menu = document.getElementById('nav-menu');
  if (menu) menu.classList.remove('open');
  if (options.scroll !== false) window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  return true;
}

window.addEventListener('portfolio-site-settings-applied', event => {
  if (activePortfolioView === 'overview' && publicPortfolioRuntime) {
    renderPortfolioOverview(
      event.detail,
      publicPortfolioRuntime.projects,
      publicPortfolioRuntime.galleries
    );
    applyGalleryBackground({ id: 'work', backgroundEnabled: false }, event.detail);
  } else if (activePortfolioGallery) {
    applyGalleryBackground(activePortfolioGallery, event.detail);
  }
});

function getLocalPortfolioData() {
  const projectSource = typeof PROJECTS_DATA !== 'undefined' ? PROJECTS_DATA : [];
  const gallerySource = typeof GALLERIES_DATA !== 'undefined' ? GALLERIES_DATA : [];
  const data = {
    projects: typeof adminStorage !== 'undefined'
      ? adminStorage.getEffective(projectSource)
      : projectSource.map(project => ({ ...project })),
    galleries: typeof adminStorage !== 'undefined'
      ? adminStorage.getEffectiveGalleries(gallerySource)
      : gallerySource.map(gallery => ({ ...gallery }))
  };
  return window.portfolioI18n ? portfolioI18n.localizePortfolio(data) : data;
}

async function getPublicPortfolioData() {
  const localFallback = getLocalPortfolioData();
  if (
    typeof portfolioBackend === 'undefined' ||
    !portfolioBackend.isConfigured()
  ) {
    return localFallback;
  }

  let timeoutId;
  try {
    const timeout = new Promise((resolve, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error('Supabase request timed out.')), 5000);
    });
    const remote = await Promise.race([
      portfolioBackend.loadPortfolio({ includeDrafts: false }),
      timeout
    ]);
    return remote
      ? (window.portfolioI18n ? portfolioI18n.localizePortfolio(remote) : remote)
      : localFallback;
  } catch (error) {
    console.warn('Could not load Supabase portfolio; using local fallback.', error);
    return localFallback;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function renderGalleryNavigation(galleries, activeId) {
  const menu = document.getElementById('nav-menu');
  if (!menu) return;
  menu.innerHTML = '';

  const overviewItem = document.createElement('li');
  overviewItem.className = 'nav-item nav-overview-item';
  const overviewLink = document.createElement('a');
  overviewLink.href = getPortfolioOverviewHref();
  overviewLink.className = 'nav-link nav-overview-link' + (activeId === 'work' ? ' active' : '');
  overviewLink.setAttribute('data-view', 'overview');
  const overviewLabel = window.portfolioI18n?.t('workOverview') || 'Visão geral do portfólio';
  overviewLink.setAttribute('aria-label', overviewLabel);
  overviewLink.title = overviewLabel;
  if (activeId === 'work') overviewLink.setAttribute('aria-current', 'page');
  const overviewSymbol = document.createElement('span');
  overviewSymbol.className = 'nav-overview-symbol';
  overviewSymbol.setAttribute('aria-hidden', 'true');
  for (let index = 0; index < 4; index += 1) {
    const cell = document.createElement('span');
    cell.className = 'nav-overview-cell';
    overviewSymbol.appendChild(cell);
  }
  overviewLink.appendChild(overviewSymbol);
  overviewItem.appendChild(overviewLink);
  menu.appendChild(overviewItem);

  galleries
    .filter(gallery => gallery.published !== false)
    .sort((a, b) => Number(a.order) - Number(b.order))
    .forEach(gallery => {
      const item = document.createElement('li');
      item.className = 'nav-item';
      const link = document.createElement('a');
      link.href = getGalleryHref(gallery.id);
      link.className = 'nav-link' + (gallery.id === activeId ? ' active' : '');
      link.setAttribute('data-section', gallery.id);
      link.setAttribute('aria-label', gallery.title);
      const label = document.createElement('span');
      label.className = 'nav-link-label';
      label.setAttribute('data-text', gallery.title);
      label.textContent = gallery.title;
      const sizer = document.createElement('span');
      sizer.className = 'nav-link-sizer';
      sizer.setAttribute('aria-hidden', 'true');
      sizer.textContent = gallery.title;
      link.append(label, sizer);
      item.appendChild(link);
      menu.appendChild(item);
    });

  window.portfolioI18n?.mountToggle();

}

/**
 * Paint the navigation from the synchronous local data before any remote
 * request starts. This keeps the fixed header geometrically complete while
 * Supabase resolves; the remote render can then refresh the same menu in place.
 */
function renderInitialGalleryNavigation() {
  const localPortfolio = getLocalPortfolioData();
  const currentPath = window.location.pathname;
  let activeId = null;
  let activeGallery = null;

  if (document.getElementById('project-gallery')) {
    if (isPortfolioOverviewLocation()) {
      activeId = 'work';
      const entryPreview = window.sectionEntryPreview?.read('work');
      renderPortfolioOverview(
        entryPreview?.settings || getCurrentWorkSettings(),
        entryPreview?.projects?.length ? entryPreview.projects : localPortfolio.projects,
        localPortfolio.galleries
      );
      document.body.classList.add('section-entry-preview-ready');
    } else {
      activeId = getGallerySectionFromLocation(
        document.getElementById('project-gallery')?.getAttribute('data-page') ||
        'featured-work'
      );
      activeGallery = resolvePublishedGallery(localPortfolio.galleries, activeId);
      activeId = activeGallery.id;
    }
  } else if (currentPath.endsWith('/project.html') || currentPath.includes('/project/')) {
    const slug = getProjectSlugFromLocation();
    const storedPreview = typeof readProjectPreview === 'function'
      ? readProjectPreview(slug)
      : null;
    const localProject = localPortfolio.projects.find(project => project.slug === slug);
    activeId = storedPreview?.section || localProject?.section || null;
  }

  renderGalleryNavigation(localPortfolio.galleries, activeId);
  if (activeGallery) applyGalleryBackground(activeGallery);
}

/**
 * Initialize the Portfolio System.
 * Reads data-page from the gallery container to identify the current page,
 * then retrieves the matching page configuration and renders the page.
 *
 * Called once per page load via DOMContentLoaded in script.js.
 */
async function initPortfolioSystem() {
  const container =
    document.getElementById('project-gallery') ||
    document.querySelector('.portfolio-grid[data-page]');
  const portfolioData = await getPublicPortfolioData();
  const galleries = portfolioData.galleries;
  if (!container) {
    renderGalleryNavigation(galleries, null);
    return;
  }
  publicPortfolioRuntime = portfolioData;
  if (isPortfolioOverviewLocation()) {
    renderGalleryNavigation(galleries, 'work');
    navigatePortfolioOverview({ history: 'none', scroll: false });
  } else {
    const requestedId = getGallerySectionFromLocation(
      container.getAttribute('data-page') || 'featured-work'
    );
    const gallery = resolvePublishedGallery(galleries, requestedId);
    renderGalleryNavigation(galleries, gallery.id);
    navigatePortfolioSection(gallery.id, { history: 'none', scroll: false });
  }
  document.body.classList.remove('section-entry-preview-ready');
  document.body.classList.remove('gallery-loading');
  document.body.classList.add('portfolio-ready');

  if (!window.__portfolioPopstateBound) {
    window.__portfolioPopstateBound = true;
    window.addEventListener('popstate', () => {
      if (isPortfolioOverviewLocation()) {
        navigatePortfolioOverview({ history: 'none', scroll: true });
      } else {
        const nextSection = getGallerySectionFromLocation('featured-work');
        navigatePortfolioSection(nextSection, { history: 'none', scroll: true });
      }
    });
  }
}
