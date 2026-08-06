/**
 * components/project-frame.js
 *
 * Reusable Project Frame Component Renderer.
 * Responsibility: Render a single project as a cinematic still article element.
 *
 * Dependencies:
 *   - escapeHtml() (defined in this file)
 */

/**
 * Safely escape HTML special characters to prevent injection.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Render a single project as a Project Frame article element.
 * Aspect Ratio Standards: '16-9' | '9-16' | '4-3'
 *
 * @param {Object} project - Project data object from PROJECTS_DATA
 * @param {Object} options - Context supplied by the gallery renderer
 * @returns {HTMLElement} article element representing a Project Frame
 */
function renderProjectFrame(project, options = {}) {
  const frame = document.createElement('article');
  const rawSize = project.size || '16-9';
  const sizeClass = `frame-${rawSize} ratio-${rawSize}`;

  frame.className = `project-frame project-card ${sizeClass}`;
  frame.setAttribute('data-category', project.category);
  frame.setAttribute('data-slug', project.slug);
  frame.setAttribute('data-size', rawSize);
  frame.setAttribute('data-id', project.id || project.slug);

  const coverImage = project.coverImage || '';
  const previewVideo = project.previewVideo || '';
  const videoType = previewVideo.toLowerCase().split('?')[0].endsWith('.webm')
    ? 'video/webm'
    : 'video/mp4';
  const thumbClasses = [
    'frame-thumb',
    coverImage ? 'has-cover' : '',
    previewVideo && !coverImage ? 'preview-only' : ''
  ].filter(Boolean).join(' ');

  frame.innerHTML = `
    <a href="project.html?slug=${encodeURIComponent(project.slug)}" class="frame-link project-link" aria-label="${escapeHtml(project.title)}">
      <div class="${thumbClasses}">
        ${coverImage
          ? `<img class="frame-cover" src="${escapeHtml(coverImage)}" alt="${escapeHtml(project.title)}" loading="lazy" />`
          : ''}
        ${previewVideo
          ? `<video class="frame-preview" muted loop playsinline preload="${coverImage ? 'metadata' : 'auto'}">
              <source src="${escapeHtml(previewVideo)}" type="${videoType}">
            </video>`
          : ''}
        ${!coverImage && !previewVideo
          ? '<div class="frame-media-empty" aria-hidden="true">NO MEDIA</div>'
          : ''}
      </div>
      <div class="frame-meta">
        <span class="frame-category">${escapeHtml(project.category)}</span>
        <h2 class="frame-title">${escapeHtml(project.title)}</h2>
      </div>
    </a>
  `;

  const projectLink = frame.querySelector('.frame-link');
  if (projectLink && typeof storeProjectPreview === 'function') {
    projectLink.addEventListener('click', () => storeProjectPreview(project, options));
  }

  const video = frame.querySelector('.frame-preview');
  const hoverCapable = !window.matchMedia ||
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (video && hoverCapable) {
    let hovering = false;
    frame.addEventListener('pointerenter', () => {
      hovering = true;
      const playback = video.play();
      if (playback && typeof playback.then === 'function') {
        playback.then(() => {
          if (hovering) frame.classList.add('is-previewing');
        }).catch(() => frame.classList.remove('is-previewing'));
      } else {
        frame.classList.add('is-previewing');
      }
    });
    frame.addEventListener('pointerleave', () => {
      hovering = false;
      frame.classList.remove('is-previewing');
      video.pause();
      try {
        video.currentTime = 0;
      } catch (error) {
        // The video may not have loaded enough metadata to seek yet.
      }
    });
  }

  return frame;
}
