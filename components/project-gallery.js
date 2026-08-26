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

const PROJECT_GALLERY_MOBILE_QUERY = '(max-width: 768px)';

/**
 * Remove measurements and observers left by a previous gallery render.
 * The renderer is called again when the active section changes, so every
 * masonry resource needs to belong to the current set of cards only.
 *
 * @param {HTMLElement} container
 */
function destroyProjectGalleryMasonry(container) {
  if (!container) return;

  container._projectGalleryGeneration = (container._projectGalleryGeneration || 0) + 1;

  if (container._projectGalleryFrame) {
    window.cancelAnimationFrame(container._projectGalleryFrame);
    container._projectGalleryFrame = 0;
  }

  if (container._projectGalleryResizeObserver) {
    container._projectGalleryResizeObserver.disconnect();
    container._projectGalleryResizeObserver = null;
  }

  if (container._projectGalleryResizeHandler) {
    window.removeEventListener('resize', container._projectGalleryResizeHandler);
    container._projectGalleryResizeHandler = null;
  }

  const mobileQuery = container._projectGalleryMobileQuery;
  const mobileHandler = container._projectGalleryMobileHandler;
  if (mobileQuery && mobileHandler) {
    if (typeof mobileQuery.removeEventListener === 'function') {
      mobileQuery.removeEventListener('change', mobileHandler);
    } else if (typeof mobileQuery.removeListener === 'function') {
      mobileQuery.removeListener(mobileHandler);
    }
  }
  container._projectGalleryMobileQuery = null;
  container._projectGalleryMobileHandler = null;

  container.classList.remove('is-masonry');
  container.querySelectorAll('.project-frame').forEach(card => {
    card.style.removeProperty('grid-column-start');
    card.style.removeProperty('grid-row-start');
    card.style.removeProperty('grid-row-end');
  });
}

/**
 * Pack cards into the currently shortest column while preserving DOM/admin
 * order. CSS Grid still owns sizing; JavaScript only calculates row spans.
 * Mobile intentionally returns to a normal one-column document flow.
 *
 * @param {HTMLElement} container
 */
function initProjectGalleryMasonry(container) {
  if (!container || typeof window === 'undefined') return;

  const cards = Array.from(container.querySelectorAll('.project-frame'));
  if (!cards.length) return;

  const generation = container._projectGalleryGeneration || 0;
  const mobileQuery = window.matchMedia(PROJECT_GALLERY_MOBILE_QUERY);

  const clearCardPlacement = () => {
    cards.forEach(card => {
      card.style.removeProperty('grid-column-start');
      card.style.removeProperty('grid-row-start');
      card.style.removeProperty('grid-row-end');
    });
  };

  const layout = () => {
    container._projectGalleryFrame = 0;
    if (container._projectGalleryGeneration !== generation) return;

    clearCardPlacement();

    if (mobileQuery.matches) {
      container.classList.remove('is-masonry');
      return;
    }

    container.classList.add('is-masonry');

    const containerStyle = window.getComputedStyle(container);
    const columns = containerStyle.gridTemplateColumns
      .split(' ')
      .filter(Boolean).length;
    const rowHeight = Number.parseFloat(containerStyle.gridAutoRows) || 4;
    const columnRows = Array.from({ length: Math.max(1, columns) }, () => 1);

    cards.forEach(card => {
      const shortestRow = Math.min(...columnRows);
      const columnIndex = columnRows.indexOf(shortestRow);
      const cardStyle = window.getComputedStyle(card);
      const bottomSpace = Number.parseFloat(cardStyle.marginBottom) || 0;
      const occupiedRows = Math.max(
        1,
        Math.ceil((card.getBoundingClientRect().height + bottomSpace) / rowHeight)
      );

      card.style.gridColumnStart = String(columnIndex + 1);
      card.style.gridRowStart = String(shortestRow);
      card.style.gridRowEnd = `span ${occupiedRows}`;
      columnRows[columnIndex] += occupiedRows;
    });
  };

  const scheduleLayout = () => {
    if (container._projectGalleryGeneration !== generation) return;
    if (container._projectGalleryFrame) {
      window.cancelAnimationFrame(container._projectGalleryFrame);
    }
    container._projectGalleryFrame = window.requestAnimationFrame(layout);
  };

  const resizeObserver = typeof ResizeObserver === 'function'
    ? new ResizeObserver(scheduleLayout)
    : null;
  if (resizeObserver) {
    cards.forEach(card => resizeObserver.observe(card));
  }

  container._projectGalleryResizeObserver = resizeObserver;
  container._projectGalleryResizeHandler = scheduleLayout;
  container._projectGalleryMobileQuery = mobileQuery;
  container._projectGalleryMobileHandler = scheduleLayout;

  window.addEventListener('resize', scheduleLayout, { passive: true });
  if (typeof mobileQuery.addEventListener === 'function') {
    mobileQuery.addEventListener('change', scheduleLayout);
  } else if (typeof mobileQuery.addListener === 'function') {
    mobileQuery.addListener(scheduleLayout);
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(scheduleLayout).catch(() => {});
  }

  scheduleLayout();
}

/**
 * Render a gallery of project frames into a target container element.
 *
 * @param {Array}         projects     - Array of project objects (defaults to PROJECTS_DATA)
 * @param {HTMLElement}   container    - DOM container to populate
 * @param {string|Object} galleryConfig - Target section name (string) or page config object
 */
function renderProjectGallery(projects, container, galleryConfig) {
  if (!container) return;

  destroyProjectGalleryMasonry(container);

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

  container.innerHTML = '';
  const galleryTitle = typeof galleryConfig === 'object' && galleryConfig
    ? galleryConfig.title || ''
    : '';
  filtered.forEach(project => {
    container.appendChild(renderProjectFrame(project, { galleryTitle }));
  });

  initProjectGalleryMasonry(container);
}
