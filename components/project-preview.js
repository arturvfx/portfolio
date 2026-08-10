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
    slug: project.slug,
    title: project.title || '',
    category: project.category || '',
    section: project.section || 'featured-work',
    galleryTitle: options.galleryTitle || '',
    size: project.size || '16-9',
    coverImage: project.coverImage || '',
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
  if (media) {
    media.className = `project-detail-media detail-ratio-${preview.size}`;
    if (preview.coverImage) {
      const image = document.createElement('img');
      image.src = preview.coverImage;
      image.alt = preview.title;
      media.replaceChildren(image);
    }
  }

  document.title = `ARTUR ARAUJO | ${preview.title}`;
  document.body.classList.remove('project-loading');
  document.body.classList.add('project-preview-ready');
  return true;
}
