/**
 * components/project-gallery.js
 *
 * Gallery-level rendering behavior.
 * Responsibility: Filter, sort and populate a gallery container with Project Frames.
 *
 * Dependencies (must be loaded before this file):
 *   - PROJECTS_DATA    (data/projects-data.js)
 *   - renderProjectFrame  (components/project-frame.js)
 */

/**
 * Render a gallery of project frames into a target container element.
 *
 * @param {Array}         projects     - Array of project objects (defaults to PROJECTS_DATA)
 * @param {HTMLElement}   container    - DOM container to populate
 * @param {string|Object} galleryConfig - Target section name (string) or page config object
 */
function renderProjectGallery(projects, container, galleryConfig) {
  if (!container) return;

  // Accept either a plain section string or a full page config object
  const targetSection = typeof galleryConfig === 'string'
    ? galleryConfig
    : (galleryConfig && (galleryConfig.projectSection || galleryConfig.id)) || 'featured-work';

  const sourceProjects = projects || (typeof PROJECTS_DATA !== 'undefined' ? PROJECTS_DATA : []);
  const excludedProjectIds = new Set(
    galleryConfig && typeof galleryConfig === 'object' && Array.isArray(galleryConfig.excludeProjectIds)
      ? galleryConfig.excludeProjectIds
      : []
  );

  const filtered = sourceProjects
    .filter(project => {
      const projectId = project.id || project.slug;
      return project.section === targetSection &&
        project.published !== false &&
        !excludedProjectIds.has(projectId);
    })
    .sort((a, b) => (a.order || 99) - (b.order || 99));

  if (typeof clearObservedProjectPreviews === 'function') {
    clearObservedProjectPreviews(container);
  }
  container.innerHTML = '';
  const galleryTitle = typeof galleryConfig === 'object' && galleryConfig
    ? galleryConfig.title || ''
    : '';
  filtered.forEach(project => {
    container.appendChild(renderProjectFrame(project, { galleryTitle }));
  });
}
