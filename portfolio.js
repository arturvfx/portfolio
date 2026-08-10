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

  // 4. Mount Project Gallery
  const containerId = pageConfig.containerId || 'project-gallery';
  const container = document.getElementById(containerId) ||
    document.querySelector('.portfolio-grid[data-page]');

  if (container) {
    renderProjectGallery(projects, container, pageConfig);
  }
}

let publicPortfolioRuntime = null;

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
    `Selected ${gallery.title.toLowerCase()} projects by VFX generalist Artur Araujo.`;
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
  updateGalleryMetadata(gallery);
  renderPortfolioPage(pageConfig, publicPortfolioRuntime.projects);

  if (options.history === 'push' || options.history === 'replace') {
    const method = options.history === 'replace' ? 'replaceState' : 'pushState';
    window.history[method]({ portfolioSection: gallery.id }, '', getGalleryHref(gallery.id));
  }

  const menu = document.getElementById('nav-menu');
  if (menu) menu.classList.remove('open');
  if (options.scroll !== false) window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  return true;
}

function getLocalPortfolioData() {
  const projectSource = typeof PROJECTS_DATA !== 'undefined' ? PROJECTS_DATA : [];
  const gallerySource = typeof GALLERIES_DATA !== 'undefined' ? GALLERIES_DATA : [];
  return {
    projects: typeof adminStorage !== 'undefined'
      ? adminStorage.getEffective(projectSource)
      : projectSource.map(project => ({ ...project })),
    galleries: typeof adminStorage !== 'undefined'
      ? adminStorage.getEffectiveGalleries(gallerySource)
      : gallerySource.map(gallery => ({ ...gallery }))
  };
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
    return remote || localFallback;
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

  if (document.getElementById('project-gallery')) {
    activeId = getGallerySectionFromLocation(
      document.getElementById('project-gallery')?.getAttribute('data-page') ||
      'featured-work'
    );
  } else if (currentPath.endsWith('/project.html') || currentPath.includes('/project/')) {
    const slug = getProjectSlugFromLocation();
    const storedPreview = typeof readProjectPreview === 'function'
      ? readProjectPreview(slug)
      : null;
    const localProject = localPortfolio.projects.find(project => project.slug === slug);
    activeId = storedPreview?.section || localProject?.section || null;
  }

  renderGalleryNavigation(localPortfolio.galleries, activeId);
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
  const requestedId = getGallerySectionFromLocation(
    container.getAttribute('data-page') || 'featured-work'
  );
  const gallery = resolvePublishedGallery(galleries, requestedId);
  renderGalleryNavigation(galleries, gallery.id);
  navigatePortfolioSection(gallery.id, { history: 'none', scroll: false });
  document.body.classList.remove('gallery-loading');
  document.body.classList.add('portfolio-ready');

  if (!window.__portfolioPopstateBound) {
    window.__portfolioPopstateBound = true;
    window.addEventListener('popstate', () => {
      const nextSection = getGallerySectionFromLocation('featured-work');
      navigatePortfolioSection(nextSection, { history: 'none', scroll: true });
    });
  }
}
