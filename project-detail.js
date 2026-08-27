/**
 * Public project detail page.
 * Loads the published portfolio, resolves one project by slug and renders its
 * existing media and metadata. Supabase remains primary; portfolio.js owns the
 * local fallback.
 */

function setProjectText(selector, value, hideParent) {
  const element = document.querySelector(selector);
  if (!element) return;
  element.textContent = value || '';
  if (hideParent && element.parentElement) element.parentElement.hidden = !value;
  else element.hidden = !value;
}

function getSafeExternalUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch (error) {
    return '';
  }
}

function resolveProjectMediaUrl(value) {
  try {
    const url = new URL(String(value || '').trim(), window.location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch (error) {
    return '';
  }
}

function markProjectDataReady() {
  document.body.classList.remove(
    'project-loading',
    'project-preview-ready',
    'project-preview-media-loading',
    'project-text-preview-ready'
  );
  document.body.classList.add('project-data-ready');
}

function openYouTubeModal(project) {
  const embedUrl = getYouTubeEmbedUrl(project.youtubeUrl, true);
  if (!embedUrl || document.querySelector('.project-video-modal')) return;

  const previousFocus = document.activeElement;
  const modal = document.createElement('div');
  modal.className = 'project-video-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', `${project.title || 'Project'} video`);

  const player = document.createElement('div');
  player.className = 'project-video-modal-player';

  const iframe = document.createElement('iframe');
  iframe.src = embedUrl;
  iframe.title = `${project.title || 'Project'} — YouTube video`;
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.allowFullscreen = true;

  const closeButton = document.createElement('button');
  closeButton.className = 'project-video-modal-close';
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Close video');
  closeButton.innerHTML = '<span aria-hidden="true"></span>';

  const closeModal = () => {
    document.removeEventListener('keydown', handleKeydown);
    document.body.classList.remove('project-video-open');
    modal.remove();
    if (previousFocus instanceof HTMLElement) previousFocus.focus();
  };

  const handleKeydown = event => {
    if (event.key === 'Escape') closeModal();
    if (event.key === 'Tab') {
      event.preventDefault();
      closeButton.focus();
    }
  };

  closeButton.addEventListener('click', closeModal);
  modal.addEventListener('click', event => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener('keydown', handleKeydown);

  player.appendChild(iframe);
  modal.append(player, closeButton);
  document.body.appendChild(modal);
  document.body.classList.add('project-video-open');
  closeButton.focus();
}

function renderProjectDetailMedia(project) {
  const container = document.getElementById('project-detail-media');
  if (!container) return;
  container.innerHTML = '';
  container.className = `project-detail-media detail-ratio-${project.size || '16-9'}`;
  const desktopFocusX = Number.isFinite(Number(project.desktopFocusX))
    ? Math.max(0, Math.min(100, Number(project.desktopFocusX)))
    : 50;
  const desktopFocusY = Number.isFinite(Number(project.desktopFocusY))
    ? Math.max(0, Math.min(100, Number(project.desktopFocusY)))
    : 50;
  const desktopCoverScale = Number.isFinite(Number(project.desktopCoverScale))
    ? Math.max(100, Math.min(200, Number(project.desktopCoverScale)))
    : 100;
  const mobileFocusX = Number.isFinite(Number(project.mobileFocusX))
    ? Math.max(0, Math.min(100, Number(project.mobileFocusX)))
    : 50;
  const mobileFocusY = Number.isFinite(Number(project.mobileFocusY))
    ? Math.max(0, Math.min(100, Number(project.mobileFocusY)))
    : 50;
  const mobileCoverScale = Number.isFinite(Number(project.mobileCoverScale))
    ? Math.max(100, Math.min(200, Number(project.mobileCoverScale)))
    : 100;
  container.style.setProperty('--desktop-focus-x', `${desktopFocusX}%`);
  container.style.setProperty('--desktop-focus-y', `${desktopFocusY}%`);
  container.style.setProperty('--desktop-cover-scale', String(desktopCoverScale / 100));
  container.style.setProperty('--mobile-focus-x', `${mobileFocusX}%`);
  container.style.setProperty('--mobile-focus-y', `${mobileFocusY}%`);
  container.style.setProperty('--mobile-cover-scale', String(mobileCoverScale / 100));

  const youtubeUrl = getYouTubeWatchUrl(project.youtubeUrl);
  if (youtubeUrl) {
    container.className = 'project-detail-media detail-ratio-16-9 has-youtube-cover';
    const link = document.createElement('button');
    link.className = 'project-youtube-cover';
    link.type = 'button';
    link.setAttribute('aria-label', `Play ${project.title || 'project'} video`);
    link.addEventListener('click', () => openYouTubeModal(project));

    if (project.coverImage) {
      const image = document.createElement('img');
      image.src = project.coverImage;
      image.alt = project.title || 'Project cover';
      link.appendChild(image);
    } else if (project.previewVideo) {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      const source = document.createElement('source');
      source.src = project.previewVideo;
      source.type = project.previewVideo.toLowerCase().split('?')[0].endsWith('.webm')
        ? 'video/webm'
        : 'video/mp4';
      video.appendChild(source);
      link.appendChild(video);
    } else {
      const fallback = document.createElement('span');
      fallback.className = 'project-youtube-cover-empty';
      fallback.textContent = project.title || 'WATCH ON YOUTUBE';
      link.appendChild(fallback);
    }

    const playIcon = document.createElement('span');
    playIcon.className = 'project-play-icon';
    playIcon.setAttribute('aria-hidden', 'true');
    link.appendChild(playIcon);
    container.appendChild(link);
    return;
  }

  if (project.previewVideo) {
    const video = document.createElement('video');
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    if (project.coverImage) video.poster = project.coverImage;
    const source = document.createElement('source');
    source.src = project.previewVideo;
    source.type = project.previewVideo.toLowerCase().split('?')[0].endsWith('.webm')
      ? 'video/webm'
      : 'video/mp4';
    video.appendChild(source);
    container.appendChild(video);
    return;
  }

  if (project.coverImage) {
    const image = document.createElement('img');
    image.src = project.coverImage;
    image.alt = project.title || 'Project cover';
    container.appendChild(image);
    return;
  }

  const empty = document.createElement('div');
  empty.className = 'project-detail-media-empty';
  empty.textContent = 'NO MEDIA';
  container.appendChild(empty);
}

function renderProjectNotFound() {
  const content = document.getElementById('project-detail-content');
  const error = document.getElementById('project-detail-error');
  if (content) content.hidden = true;
  if (error) error.hidden = false;
  document.title = 'ARTUR ARAUJO | Project not found';
  document.querySelector('meta[name="robots"]')?.setAttribute('content', 'noindex, follow');
  markProjectDataReady();
}

function renderProjectEditorial(project) {
  const services = document.getElementById('project-detail-services');
  const serviceItems = Array.isArray(project.services)
    ? project.services.map(item => String(item).trim()).filter(Boolean)
    : [];
  if (services) {
    services.innerHTML = '';
    serviceItems.forEach(service => {
      const item = document.createElement('li');
      item.textContent = service;
      services.appendChild(item);
    });
  }
  const servicesBlock = document.getElementById('project-detail-services-block');
  if (servicesBlock) servicesBlock.hidden = serviceItems.length === 0;

  const watchNow = document.getElementById('project-watch-now');
  const watchNowUrl = project.watchNowEnabled ? getSafeExternalUrl(project.watchNowUrl) : '';
  if (watchNow) {
    watchNow.hidden = !watchNowUrl;
    if (watchNowUrl) watchNow.href = watchNowUrl;
    else watchNow.removeAttribute('href');
  }

  setProjectText('#project-detail-summary', project.projectSummary);
  setProjectText('#project-detail-contribution', project.contribution);
  const contextBlock = document.getElementById('project-context-block');
  const contributionBlock = document.getElementById('project-contribution-block');
  if (contextBlock) contextBlock.hidden = !project.projectSummary;
  if (contributionBlock) contributionBlock.hidden = !project.contribution;
  const editorial = document.getElementById('project-detail-editorial');
  if (editorial) editorial.hidden = !project.projectSummary && !project.contribution;

  setProjectText('#project-detail-director', project.director);
  setProjectText('#project-detail-production', project.productionCompany);
  const directorCredit = document.getElementById('project-director-credit');
  const productionCredit = document.getElementById('project-production-credit');
  if (directorCredit) directorCredit.hidden = !project.director;
  if (productionCredit) productionCredit.hidden = !project.productionCompany;
  const credits = document.getElementById('project-detail-credits');
  if (credits) credits.hidden = !project.director && !project.productionCompany;
}

function openProjectStill(still, project, index) {
  if (!still?.url || document.querySelector('.project-still-modal')) return;

  const previousFocus = document.activeElement;
  const modal = document.createElement('div');
  modal.className = 'project-still-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', `${project.title || 'Project'} — still ${index + 1}`);

  const image = document.createElement('img');
  image.className = 'project-still-modal-image';
  image.src = still.url;
  image.alt = `${project.title || 'Project'} — still ${index + 1}`;

  const closeButton = document.createElement('button');
  closeButton.className = 'project-video-modal-close project-still-modal-close';
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Close image');
  closeButton.innerHTML = '<span aria-hidden="true"></span>';

  const closeModal = () => {
    document.removeEventListener('keydown', handleKeydown);
    document.body.classList.remove('project-still-open');
    modal.remove();
    if (previousFocus instanceof HTMLElement) previousFocus.focus();
  };

  const handleKeydown = event => {
    if (event.key === 'Escape') closeModal();
    if (event.key === 'Tab') {
      event.preventDefault();
      closeButton.focus();
    }
  };

  closeButton.addEventListener('click', closeModal);
  modal.addEventListener('click', event => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener('keydown', handleKeydown);

  modal.append(image, closeButton);
  document.body.appendChild(modal);
  document.body.classList.add('project-still-open');
  closeButton.focus();
}

function renderProjectStills(project) {
  const section = document.getElementById('project-detail-stills');
  const grid = document.getElementById('project-detail-stills-grid');
  if (!section || !grid) return;
  const stills = typeof normalizeProjectStills === 'function'
    ? normalizeProjectStills(project.projectStills)
    : [];

  grid.replaceChildren();
  stills.forEach((still, index) => {
    const frame = document.createElement('button');
    frame.className = `project-detail-still project-detail-still-${still.size}`;
    frame.type = 'button';
    frame.setAttribute('aria-label', `Open ${project.title || 'project'} still ${index + 1}`);
    frame.addEventListener('click', () => openProjectStill(still, project, index));

    const image = document.createElement('img');
    image.src = still.url;
    image.alt = `${project.title || 'Project'} — still ${index + 1}`;
    image.loading = 'lazy';
    image.decoding = 'async';
    frame.appendChild(image);
    grid.appendChild(frame);
  });
  section.hidden = stills.length === 0;
}

async function initProjectDetail() {
  const slug = getProjectSlugFromLocation();
  const portfolioData = await getPublicPortfolioData();
  const project = portfolioData.projects.find(item =>
    item.slug === slug && item.published !== false
  );

  if (!project) {
    renderGalleryNavigation(portfolioData.galleries, null);
    renderProjectNotFound();
    return;
  }

  renderGalleryNavigation(portfolioData.galleries, project.section);
  updateProjectMetadata(project);

  const title = document.getElementById('project-detail-title');
  if (title) {
    title.textContent = project.title;
    title.setAttribute('data-text', project.title);
  }
  setProjectText('#project-detail-category', project.category);
  setProjectText('#project-detail-client', project.client, true);
  setProjectText('#project-detail-year', project.year, true);
  renderProjectEditorial(project);
  renderProjectStills(project);

  const backLink = document.getElementById('project-back-link');
  if (backLink) {
    const gallery = portfolioData.galleries.find(item => item.id === project.section);
    const storedPreview = typeof readProjectPreview === 'function'
      ? readProjectPreview(project.slug)
      : null;
    backLink.href = storedPreview?.sourceHref || getGalleryHref(project.section);
    backLink.textContent = `← ${storedPreview?.sourceLabel || (gallery ? gallery.title : 'BACK TO GALLERY')}`;
  }

  renderProjectDetailMedia(project);
  markProjectDataReady();
}

function updateProjectMetadata(project) {
  const title = `ARTUR ARAUJO | ${project.title}`;
  const fallbackDetails = [project.client, project.category, project.year].filter(Boolean).join(' — ');
  const description = (project.projectSummary || `${project.title}${fallbackDetails ? ` — ${fallbackDetails}` : ''}.`)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
  document.title = title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);

  const canonicalUrl = getCanonicalProjectUrl(project.slug);
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonicalUrl);
  setProjectMeta('property', 'og:url', canonicalUrl);

  if (project.coverImage) {
    const imageUrl = resolveProjectMediaUrl(project.coverImage);
    if (imageUrl) {
      setProjectMeta('property', 'og:image', imageUrl);
      setProjectMeta('name', 'twitter:image', imageUrl);
    }
  }
}

function setProjectMeta(attribute, key, value) {
  let element = document.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', value);
}
