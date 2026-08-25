/**
 * Editorial opening hero for a project section.
 * Desktop uses a title index with hover/focus image switching. Mobile keeps
 * vertical page scrolling free and changes projects only with a horizontal swipe.
 */

function selectSectionHeroProjects(projects, galleryConfig) {
  if (!galleryConfig || galleryConfig.heroEnabled !== true) return [];
  const sectionId = galleryConfig.projectSection || galleryConfig.id;
  return (projects || [])
    .filter(project => project.section === sectionId && project.published !== false)
    .sort((a, b) => Number(a.order || 99) - Number(b.order || 99))
    .slice(0, 3);
}

function getSectionHeroImage(project) {
  if (project.coverImage) return project.coverImage;
  const firstStill = Array.isArray(project.projectStills) ? project.projectStills[0] : null;
  return firstStill && firstStill.url ? firstStill.url : '';
}

function renderSectionHero(projects, container, options = {}) {
  if (!container) return;
  if (container._backgroundObserver) {
    container._backgroundObserver.disconnect();
    container._backgroundObserver = null;
  }
  container.replaceChildren();

  if (!Array.isArray(projects) || !projects.length) {
    container.hidden = true;
    container.removeAttribute('aria-label');
    document.body.classList.remove('section-hero-active');
    return;
  }

  container.hidden = false;
  document.body.classList.add('section-hero-active');
  const galleryTitle = options.galleryTitle || '';
  container.setAttribute('aria-label', `${galleryTitle || 'Section'} featured projects`);
  const root = document.createElement('div');
  root.className = 'section-hero-inner';

  const media = document.createElement('div');
  media.className = 'section-hero-media';
  media.setAttribute('aria-hidden', 'true');
  const mediaItems = projects.map((project, index) => {
    const item = document.createElement('div');
    item.className = `section-hero-media-item${index === 0 ? ' is-active' : ''}`;
    const imageUrl = getSectionHeroImage(project);
    if (imageUrl) {
      const image = document.createElement('img');
      image.src = imageUrl;
      image.alt = '';
      image.loading = 'eager';
      image.decoding = 'async';
      if (index === 0) image.setAttribute('fetchpriority', 'high');
      item.appendChild(image);
    } else if (project.previewVideo) {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = index === 0 ? 'auto' : 'metadata';
      video.setAttribute('aria-hidden', 'true');
      const source = document.createElement('source');
      source.src = project.previewVideo;
      source.type = project.previewVideo.toLowerCase().split('?')[0].endsWith('.webm')
        ? 'video/webm'
        : 'video/mp4';
      video.appendChild(source);
      item.appendChild(video);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'section-hero-media-empty';
      placeholder.textContent = 'NO MEDIA';
      item.appendChild(placeholder);
    }
    media.appendChild(item);
    return item;
  });

  const shade = document.createElement('div');
  shade.className = 'section-hero-shade';
  shade.setAttribute('aria-hidden', 'true');

  const desktopNav = document.createElement('nav');
  desktopNav.className = 'section-hero-desktop';
  desktopNav.setAttribute('aria-label', 'Featured projects');
  const list = document.createElement('ol');
  list.className = 'section-hero-list';
  const desktopLinks = [];

  projects.forEach((project, index) => {
    const listItem = document.createElement('li');
    listItem.className = `section-hero-list-item${index === 0 ? ' is-active' : ''}`;
    const link = document.createElement('a');
    link.className = 'section-hero-project-link';
    link.href = getProjectHref(project.slug);
    link.setAttribute('aria-label', project.year ? `${project.title}, ${project.year}` : project.title);
    const title = document.createElement('span');
    title.className = 'section-hero-project-title';
    title.textContent = project.title;
    link.appendChild(title);
    if (project.year) {
      const year = document.createElement('span');
      year.className = 'section-hero-project-year';
      year.textContent = project.year;
      link.appendChild(year);
    }
    link.addEventListener('click', () => {
      if (typeof storeProjectPreview === 'function') {
        storeProjectPreview(project, { galleryTitle });
      }
    });
    listItem.appendChild(link);
    list.appendChild(listItem);
    desktopLinks.push({ listItem, link });
  });
  desktopNav.appendChild(list);

  const mobileContent = document.createElement('div');
  mobileContent.className = 'section-hero-mobile';
  mobileContent.setAttribute('aria-live', 'polite');
  const mobileLink = document.createElement('a');
  mobileLink.className = 'section-hero-mobile-link';
  const mobileTitle = document.createElement('span');
  mobileTitle.className = 'section-hero-mobile-title';
  const mobileYear = document.createElement('span');
  mobileYear.className = 'section-hero-mobile-year';
  mobileLink.append(mobileTitle, mobileYear);
  const counter = document.createElement('div');
  counter.className = 'section-hero-counter';
  const counterCurrent = document.createElement('span');
  counterCurrent.className = 'section-hero-counter-current';
  const counterLine = document.createElement('span');
  counterLine.className = 'section-hero-counter-line';
  const counterTotal = document.createElement('span');
  counterTotal.className = 'section-hero-counter-total';
  counterTotal.textContent = String(projects.length);
  counter.append(counterCurrent, counterLine, counterTotal);
  mobileContent.append(mobileLink, counter);

  const downButton = document.createElement('button');
  downButton.className = 'section-hero-down';
  downButton.type = 'button';
  downButton.setAttribute('aria-label', 'View the rest of the projects');
  downButton.textContent = '↓';
  downButton.addEventListener('click', () => {
    document.querySelector('.page-container')?.scrollIntoView({ behavior: 'auto', block: 'start' });
  });

  let activeIndex = 0;
  function setActiveProject(nextIndex) {
    activeIndex = Math.max(0, Math.min(projects.length - 1, nextIndex));
    mediaItems.forEach((item, index) => item.classList.toggle('is-active', index === activeIndex));
    desktopLinks.forEach((item, index) => item.listItem.classList.toggle('is-active', index === activeIndex));
    const project = projects[activeIndex];
    mobileTitle.textContent = project.title;
    mobileYear.textContent = project.year || '';
    mobileYear.hidden = !project.year;
    mobileLink.href = getProjectHref(project.slug);
    mobileLink.setAttribute('aria-label', project.year ? `${project.title}, ${project.year}` : project.title);
    counterCurrent.textContent = String(activeIndex + 1);
  }

  desktopLinks.forEach((item, index) => {
    item.listItem.addEventListener('pointerenter', () => setActiveProject(index));
    item.link.addEventListener('focus', () => setActiveProject(index));
  });
  mobileLink.addEventListener('click', () => {
    if (typeof storeProjectPreview === 'function') {
      storeProjectPreview(projects[activeIndex], { galleryTitle });
    }
  });

  let pointerStart = null;
  let suppressClick = false;
  root.addEventListener('pointerdown', event => {
    if (!window.matchMedia('(max-width: 900px)').matches || !event.isPrimary) return;
    pointerStart = { x: event.clientX, y: event.clientY };
  });
  root.addEventListener('pointerup', event => {
    if (!pointerStart || !window.matchMedia('(max-width: 900px)').matches) return;
    const deltaX = event.clientX - pointerStart.x;
    const deltaY = event.clientY - pointerStart.y;
    pointerStart = null;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    suppressClick = true;
    setActiveProject(activeIndex + (deltaX < 0 ? 1 : -1));
    window.setTimeout(() => { suppressClick = false; }, 0);
  });
  root.addEventListener('pointercancel', () => { pointerStart = null; });
  mobileLink.addEventListener('click', event => {
    if (suppressClick) event.preventDefault();
  }, true);
  root.addEventListener('keydown', event => {
    if (!window.matchMedia('(max-width: 900px)').matches) return;
    if (event.key === 'ArrowLeft') setActiveProject(activeIndex - 1);
    if (event.key === 'ArrowRight') setActiveProject(activeIndex + 1);
  });

  root.append(media, shade, desktopNav, mobileContent);
  if (options.hasRemainingProjects !== false) root.appendChild(downButton);
  container.appendChild(root);
  setActiveProject(0);

  if ('IntersectionObserver' in window) {
    container._backgroundObserver = new IntersectionObserver(entries => {
      const backgroundVideo = document.getElementById('bg-video');
      if (!backgroundVideo || document.body.classList.contains('gallery-solid-background')) return;
      const heroIsCoveringThePage = entries[0] && entries[0].intersectionRatio > 0.4;
      if (heroIsCoveringThePage) {
        backgroundVideo.pause();
      } else {
        const playback = backgroundVideo.play();
        if (playback?.catch) playback.catch(() => {});
      }
    }, { threshold: [0, 0.4] });
    container._backgroundObserver.observe(container);
  }
}
