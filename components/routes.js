/**
 * Public URL helpers.
 *
 * The deployed site uses clean, readable paths while a basic localhost static
 * server keeps using the underlying HTML files and query strings.
 */

const PORTFOLIO_TOP_LEVEL_SECTIONS = new Set([
  'featured-work',
  'content-editing',
  'digital-alchemy'
]);

function isLocalStaticPreview() {
  return window.location.protocol === 'file:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.endsWith('.local');
}

function usesLegacyStaticRoutes() {
  return isLocalStaticPreview() && (
    window.location.pathname === '/' ||
    window.location.pathname.endsWith('.html')
  );
}

function getGalleryHref(sectionId) {
  const section = String(sectionId || 'featured-work').trim() || 'featured-work';
  const encodedSection = encodeURIComponent(section);

  if (usesLegacyStaticRoutes()) {
    return `gallery.html?section=${encodedSection}`;
  }

  return PORTFOLIO_TOP_LEVEL_SECTIONS.has(section)
    ? `/${encodedSection}`
    : `/work/${encodedSection}`;
}

function getPortfolioOverviewHref() {
  return usesLegacyStaticRoutes()
    ? 'gallery.html?view=overview'
    : '/work';
}

function isPortfolioOverviewLocation() {
  const queryView = new URLSearchParams(window.location.search).get('view');
  if (queryView === 'overview') return true;
  const segments = window.location.pathname.split('/').filter(Boolean);
  return segments.length === 1 && segments[0] === 'work';
}

function getPublicGalleryPath(sectionId) {
  const section = String(sectionId || 'featured-work').trim() || 'featured-work';
  const encodedSection = encodeURIComponent(section);
  return PORTFOLIO_TOP_LEVEL_SECTIONS.has(section)
    ? `/${encodedSection}`
    : `/work/${encodedSection}`;
}

function decodePathSegment(value) {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
}

function getGallerySectionFromLocation(fallback = 'featured-work') {
  const querySection = new URLSearchParams(window.location.search).get('section');
  if (querySection) return querySection;

  const segments = window.location.pathname.split('/').filter(Boolean);
  if (segments[0] === 'work' && segments[1]) {
    return decodePathSegment(segments[1]);
  }

  if (segments.length === 1 && PORTFOLIO_TOP_LEVEL_SECTIONS.has(segments[0])) {
    return segments[0];
  }

  return fallback;
}

function getProjectHref(slug) {
  const encodedSlug = encodeURIComponent(String(slug || '').trim());
  return usesLegacyStaticRoutes()
    ? `project.html?slug=${encodedSlug}`
    : `/project/${encodedSlug}`;
}

function getProjectSlugFromLocation() {
  const querySlug = new URLSearchParams(window.location.search).get('slug');
  if (querySlug) return querySlug;

  const segments = window.location.pathname.split('/').filter(Boolean);
  return segments[0] === 'project' && segments[1]
    ? decodePathSegment(segments[1])
    : null;
}

function getCanonicalGalleryUrl(sectionId) {
  return `https://arturaraujo.com${getPublicGalleryPath(sectionId)}`;
}

function getCanonicalPortfolioOverviewUrl() {
  return 'https://arturaraujo.com/work';
}

function getCanonicalProjectUrl(slug) {
  return `https://arturaraujo.com/project/${encodeURIComponent(slug)}`;
}
