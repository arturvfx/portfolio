/**
 * Fast project-page handoff.
 * Stores the clicked gallery project's visible data in sessionStorage so the
 * detail hero can be hydrated before the remote portfolio request completes.
 */

const PROJECT_PREVIEW_STORAGE_KEY = 'portfolio-project-preview-v1';
const PROJECT_PREVIEW_MAX_AGE = 30 * 60 * 1000;
const PROJECT_PRELOAD_LIMIT = 2;
const projectPreloads = new Map();
let mobileProjectObserver = null;

function preloadProjectPreview(project) {
  const url = project && typeof project.coverImage === 'string' ? project.coverImage.trim() : '';
  if (!url) return Promise.resolve(false);
  if (projectPreloads.has(url)) return projectPreloads.get(url);

  const preload = new Promise(resolve => {
    const image = new Image();
    let settled = false;
    const finish = loaded => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      resolve(loaded);
    };
    const timeoutId = window.setTimeout(() => finish(false), 5000);
    image.addEventListener('load', () => finish(true), { once: true });
    image.addEventListener('error', () => finish(false), { once: true });
    image.src = url;
    if (image.complete && image.naturalWidth) finish(true);
  });

  projectPreloads.set(url, preload);
  while (projectPreloads.size > PROJECT_PRELOAD_LIMIT) {
    projectPreloads.delete(projectPreloads.keys().next().value);
  }
  return preload;
}

function observeMobileProjectPreview(element, project) {
  const isMobile = window.matchMedia &&
    window.matchMedia('(max-width: 900px), (hover: none), (pointer: coarse)').matches;
  if (!element || !project || !isMobile || !('IntersectionObserver' in window)) return;

  if (!mobileProjectObserver) {
    mobileProjectObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const observedProject = entry.target._previewProject;
        if (observedProject) preloadProjectPreview(observedProject);
        mobileProjectObserver.unobserve(entry.target);
        delete entry.target._previewProject;
      });
    }, { rootMargin: '280px 0px', threshold: 0.01 });
  }

  element._previewProject = project;
  mobileProjectObserver.observe(element);
}

function clearObservedProjectPreviews(container) {
  if (!container || !mobileProjectObserver) return;
  container.querySelectorAll('.project-frame').forEach(frame => {
    mobileProjectObserver.unobserve(frame);
    delete frame._previewProject;
  });
}

function storeProjectPreview(project, options = {}) {
  if (!project || !project.slug) return;

  const preview = {
    slug: project.slug,
    title: project.title || '',
    category: project.category || '',
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

  const gallery = typeof GALLERIES_DATA !== 'undefined'
    ? GALLERIES_DATA.find(item => item.id === preview.section)
    : null;
  const backLink = document.getElementById('project-back-link');
  if (backLink) {
    backLink.href = getGalleryHref(preview.section);
    backLink.textContent = `← ${preview.galleryTitle || (gallery ? gallery.title : 'BACK TO GALLERY')}`;
  }

  const media = document.getElementById('project-detail-media');
  let waitsForCover = false;
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
      waitsForCover = true;
      const reveal = () => {
        document.body.classList.remove('project-loading');
        document.body.classList.add('project-preview-ready');
      };
      if (image.complete && image.naturalWidth) reveal();
      else {
        image.addEventListener('load', reveal, { once: true });
      }
    }
  }

  document.title = `ARTUR ARAUJO | ${preview.title}`;
  if (!waitsForCover) {
    document.body.classList.remove('project-loading');
    document.body.classList.add('project-preview-ready');
  }
  return true;
}
