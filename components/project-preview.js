/**
 * Fast project-page handoff.
 * Stores the clicked gallery project's visible data in sessionStorage so the
 * detail hero can be hydrated before the remote portfolio request completes.
 */

const PROJECT_PREVIEW_STORAGE_KEY = 'portfolio-project-preview-v1';
const PROJECT_PREVIEW_MAX_AGE = 30 * 60 * 1000;

function storeProjectPreview(project, options = {}) {
  if (!project || !project.slug) return;

  const preview = {
    version: 2,
    slug: project.slug,
    title: project.title || '',
    category: project.category || '',
    client: project.client || '',
    year: project.year || '',
    services: Array.isArray(project.services) ? project.services.filter(Boolean) : [],
    projectSummary: project.projectSummary || '',
    contribution: project.contribution || '',
    director: project.director || '',
    productionCompany: project.productionCompany || '',
    watchNowEnabled: project.watchNowEnabled === true,
    watchNowUrl: project.watchNowUrl || '',
    section: project.section || 'featured-work',
    galleryTitle: options.galleryTitle || '',
    size: project.size || '16-9',
    coverImage: project.coverImage || '',
    mobileFocusX: Number.isFinite(Number(project.mobileFocusX)) ? Number(project.mobileFocusX) : 50,
    mobileFocusY: Number.isFinite(Number(project.mobileFocusY)) ? Number(project.mobileFocusY) : 50,
    mobileCoverScale: Number.isFinite(Number(project.mobileCoverScale)) ? Number(project.mobileCoverScale) : 100,
    savedAt: Date.now()
  };

  try {
    window.sessionStorage.setItem(PROJECT_PREVIEW_STORAGE_KEY, JSON.stringify(preview));
  } catch (error) {
    // Storage can be unavailable in privacy modes; full loading still works.
  }
}

function readProjectPreview(slug) {
  try {
    const raw = window.sessionStorage.getItem(PROJECT_PREVIEW_STORAGE_KEY);
    if (!raw) return null;
    const preview = JSON.parse(raw);
    const isFresh = Number(preview.savedAt) > Date.now() - PROJECT_PREVIEW_MAX_AGE;
    return preview.slug === slug && isFresh ? preview : null;
  } catch (error) {
    return null;
  }
}

function hydrateStoredProjectPreview() {
  const slug = getProjectSlugFromLocation();
  const preview = readProjectPreview(slug);
  if (!preview || !preview.title) return false;

  const title = document.getElementById('project-detail-title');
  if (title) {
    title.textContent = preview.title;
    title.setAttribute('data-text', preview.title);
  }

  const category = document.getElementById('project-detail-category');
  if (category) {
    category.textContent = preview.category;
    category.hidden = !preview.category;
  }

  if (Number(preview.version) >= 2) {
    const client = document.getElementById('project-detail-client');
    const year = document.getElementById('project-detail-year');
    if (client) {
      client.textContent = preview.client || '';
      if (client.parentElement) client.parentElement.hidden = !preview.client;
    }
    if (year) {
      year.textContent = preview.year || '';
      if (year.parentElement) year.parentElement.hidden = !preview.year;
    }

    const servicesBlock = document.getElementById('project-detail-services-block');
    const services = document.getElementById('project-detail-services');
    if (services) {
      services.replaceChildren(...preview.services.map(service => {
        const item = document.createElement('li');
        item.textContent = service;
        return item;
      }));
    }
    if (servicesBlock) servicesBlock.hidden = preview.services.length === 0;

    const summaryBlock = document.getElementById('project-context-block');
    const summary = document.getElementById('project-detail-summary');
    const contributionBlock = document.getElementById('project-contribution-block');
    const contribution = document.getElementById('project-detail-contribution');
    const editorial = document.getElementById('project-detail-editorial');
    if (summary) summary.textContent = preview.projectSummary || '';
    if (contribution) contribution.textContent = preview.contribution || '';
    if (summaryBlock) summaryBlock.hidden = !preview.projectSummary;
    if (contributionBlock) contributionBlock.hidden = !preview.contribution;
    if (editorial) editorial.hidden = !preview.projectSummary && !preview.contribution;

    const directorCredit = document.getElementById('project-director-credit');
    const director = document.getElementById('project-detail-director');
    const productionCredit = document.getElementById('project-production-credit');
    const production = document.getElementById('project-detail-production');
    const credits = document.getElementById('project-detail-credits');
    if (director) director.textContent = preview.director || '';
    if (production) production.textContent = preview.productionCompany || '';
    if (directorCredit) directorCredit.hidden = !preview.director;
    if (productionCredit) productionCredit.hidden = !preview.productionCompany;
    if (credits) credits.hidden = !preview.director && !preview.productionCompany;

    const watchNow = document.getElementById('project-watch-now');
    if (watchNow) {
      let watchUrl = '';
      try {
        const parsed = new URL(preview.watchNowUrl);
        if (['http:', 'https:'].includes(parsed.protocol)) watchUrl = parsed.toString();
      } catch (error) {
        watchUrl = '';
      }
      watchNow.href = watchUrl;
      watchNow.hidden = !preview.watchNowEnabled || !watchUrl;
    }
    document.body.classList.add('project-text-preview-ready');
  }

  const gallery = typeof GALLERIES_DATA !== 'undefined'
    ? GALLERIES_DATA.find(item => item.id === preview.section)
    : null;
  const backLink = document.getElementById('project-back-link');
  if (backLink) {
    backLink.href = getGalleryHref(preview.section);
    backLink.textContent = `← ${preview.galleryTitle || (gallery ? gallery.title : 'BACK TO GALLERY')}`;
  }

  const media = document.getElementById('project-detail-media');
  if (media) {
    media.className = `project-detail-media detail-ratio-${preview.size}`;
    const mobileFocusX = Number.isFinite(Number(preview.mobileFocusX))
      ? Math.max(0, Math.min(100, Number(preview.mobileFocusX)))
      : 50;
    const mobileFocusY = Number.isFinite(Number(preview.mobileFocusY))
      ? Math.max(0, Math.min(100, Number(preview.mobileFocusY)))
      : 50;
    const mobileCoverScale = Number.isFinite(Number(preview.mobileCoverScale))
      ? Math.max(100, Math.min(200, Number(preview.mobileCoverScale)))
      : 100;
    media.style.setProperty('--mobile-focus-x', `${mobileFocusX}%`);
    media.style.setProperty('--mobile-focus-y', `${mobileFocusY}%`);
    media.style.setProperty('--mobile-cover-scale', String(mobileCoverScale / 100));
    if (preview.coverImage) {
      const image = document.createElement('img');
      image.src = preview.coverImage;
      image.alt = preview.title;
      media.replaceChildren(image);
      document.body.classList.add('project-preview-media-loading');
      const reveal = () => {
        document.body.classList.remove('project-preview-media-loading');
      };
      if (image.complete && image.naturalWidth) reveal();
      else {
        image.addEventListener('load', reveal, { once: true });
      }
    }
  }

  document.title = `ARTUR ARAUJO | ${preview.title}`;
  document.body.classList.remove('project-loading');
  document.body.classList.add('project-preview-ready');
  return true;
}
