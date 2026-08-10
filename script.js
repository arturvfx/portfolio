document.addEventListener('DOMContentLoaded', async () => {
  // Slow background video playback rate for projected cinema feel
  const video = document.getElementById('bg-video');
  if (video) {
    video.playbackRate = 0.45;
  }

  // Cursor Shadow physics-based tracking
  const shadowEl = document.getElementById('cursor-shadow');
  let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  let shadow = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  let shadowActive = false;

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;

    if (!shadowActive && shadowEl) {
      shadowActive = true;
      shadowEl.style.opacity = '1';
    }
  });

  function updateShadow() {
    if (mouse.x !== null && mouse.y !== null && shadowEl) {
      const targetX = mouse.x + (mouse.x - window.innerWidth / 2) * 0.05;
      const targetY = mouse.y + (mouse.y - window.innerHeight / 2) * 0.05;

      shadow.x += (targetX - shadow.x) * 0.07;
      shadow.y += (targetY - shadow.y) * 0.07;

      shadowEl.style.transform = `translate3d(${shadow.x}px, ${shadow.y}px, 0)`;
    }
    requestAnimationFrame(updateShadow);
  }

  // Mechanical Projector Shutter Click & Organic Projector Flicker Handling
  const enterBtn = document.getElementById('enter-button');
  if (enterBtn) {
    let isHovered = false;
    let interactionFlickerToken = 0;
    const enterReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Non-periodic projector flicker: light/focus only, never positional movement.
    function triggerFlicker() {
      if (document.hidden || isHovered || enterReducedMotion) {
        scheduleNextFlicker();
        return;
      }

      const flickerType = Math.floor(Math.random() * 4);

      if (flickerType === 0) {
        applyFlickerState({ op: -0.12, blur: '0.82px', brightness: 0.72 });
        setTimeout(() => resetFlickerState(), 70 + Math.random() * 40);
      } else if (flickerType === 1) {
        applyFlickerState({ op: -0.09, blur: '0.72px', brightness: 0.8 });
        setTimeout(() => {
          resetFlickerState();
          setTimeout(() => {
            applyFlickerState({ op: 0.05, blur: '0.46px', brightness: 1.2 });
            setTimeout(() => resetFlickerState(), 50);
          }, 40 + Math.random() * 30);
        }, 60);
      } else if (flickerType === 2) {
        applyFlickerState({ op: 0.08, blur: '0.45px', brightness: 1.22 });
        setTimeout(() => resetFlickerState(), 80 + Math.random() * 30);
      } else {
        applyFlickerState({ op: -0.05, blur: '0.7px', brightness: 0.88 });
        setTimeout(() => resetFlickerState(), 60 + Math.random() * 30);
      }

      scheduleNextFlicker();
    }

    function applyFlickerState({ op = 0, blur = '0.62px', brightness = 1 }, force = false) {
      if (isHovered && !force) return;
      enterBtn.style.setProperty('--btn-flicker-op', `${op}`);
      enterBtn.style.setProperty('--btn-blur', blur);
      enterBtn.style.setProperty('--btn-brightness', `${brightness}`);
    }

    function resetFlickerState() {
      enterBtn.style.setProperty('--btn-flicker-op', '0');
      enterBtn.style.setProperty('--btn-blur', isHovered ? '0px' : '0.62px');
      enterBtn.style.setProperty('--btn-brightness', '1');
    }

    function runEnterInteractionFlicker() {
      if (enterReducedMotion) {
        resetFlickerState();
        return;
      }

      const token = ++interactionFlickerToken;
      applyFlickerState({ op: -0.28, blur: '0.72px', brightness: 0.68 }, true);
      setTimeout(() => {
        if (token !== interactionFlickerToken) return;
        applyFlickerState({ op: 0, blur: '0px', brightness: 1.26 }, true);
        setTimeout(() => {
          if (token === interactionFlickerToken) resetFlickerState();
        }, 52);
      }, 58);
    }

    function scheduleNextFlicker() {
      // Non-periodic randomized timing between 2.5 and 6.5 seconds
      const nextDelay = 2500 + Math.random() * 4000;
      setTimeout(triggerFlicker, nextDelay);
    }

    enterBtn.addEventListener('mouseenter', () => {
      isHovered = true;
      runEnterInteractionFlicker();
    });
    enterBtn.addEventListener('mouseleave', () => {
      isHovered = false;
      interactionFlickerToken += 1;
      resetFlickerState();
    });
    enterBtn.addEventListener('focus', () => {
      isHovered = true;
      runEnterInteractionFlicker();
    });
    enterBtn.addEventListener('blur', () => {
      isHovered = false;
      interactionFlickerToken += 1;
      resetFlickerState();
    });

    if (!enterReducedMotion) setTimeout(scheduleNextFlicker, 2000);

    // Mechanical Shutter Click & Page Navigation Handling for ENTER
    enterBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetUrl = getGalleryHref('featured-work');

      document.body.classList.add('shutter-click-active');

      setTimeout(() => {
        document.body.classList.add('page-transition-out');
        setTimeout(() => {
          window.location.href = targetUrl;
        }, 300);
      }, 260);
    });
  }

  // Build the current data-driven page before binding its generated links.
  if (typeof initProjectDetail === 'function') {
    await initProjectDetail();
  } else if (typeof initPortfolioSystem === 'function') {
    await initPortfolioSystem();
  }

  // Projector-voltage artifacts: light variation only, never positional movement.
  const navBrand = document.querySelector('.nav-brand');
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const menuNavLinks = document.querySelectorAll('.nav-link');
  const navToggle = document.getElementById('nav-toggle');
  const navMenu = document.getElementById('nav-menu');
  const flickerClasses = ['is-nav-light-dip', 'is-nav-light-flare', 'is-nav-light-pulse'];
  const navFlickerTokens = new WeakMap();

  function setMobileMenuOpen(open) {
    if (!navMenu || !navToggle) return;
    navMenu.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.documentElement.classList.toggle('mobile-menu-open', open);
    document.body.classList.toggle('mobile-menu-open', open);
  }

  function clearNavFlicker(link) {
    link.classList.remove(...flickerClasses);
  }

  function nextNavFlickerToken(link) {
    const token = (navFlickerTokens.get(link) || 0) + 1;
    navFlickerTokens.set(link, token);
    return token;
  }

  function runNavInteractionFlicker(link) {
    if (reducedMotion) return;
    const token = nextNavFlickerToken(link);
    clearNavFlicker(link);
    link.classList.add('is-nav-light-dip');

    window.setTimeout(() => {
      if (navFlickerTokens.get(link) !== token) return;
      clearNavFlicker(link);
      link.classList.add('is-nav-light-flare');

      window.setTimeout(() => {
        if (navFlickerTokens.get(link) === token) clearNavFlicker(link);
      }, 52);
    }, 58);
  }

  menuNavLinks.forEach(link => {
    link.addEventListener('mouseenter', () => {
      if (!link.classList.contains('active')) runNavInteractionFlicker(link);
    });
    link.addEventListener('focus', () => {
      if (!link.classList.contains('active')) runNavInteractionFlicker(link);
    });
    link.addEventListener('mouseleave', () => {
      nextNavFlickerToken(link);
      clearNavFlicker(link);
    });
    link.addEventListener('blur', () => {
      nextNavFlickerToken(link);
      clearNavFlicker(link);
    });
    link.addEventListener('click', event => {
      setMobileMenuOpen(false);
      const currentUrl = new URL(window.location.href);
      const targetUrl = new URL(link.href, window.location.href);
      const targetSection = link.getAttribute('data-section') || targetUrl.searchParams.get('section');
      const isGalleryPage = Boolean(document.getElementById('project-gallery'));

      if (isGalleryPage && targetSection && typeof navigatePortfolioSection === 'function') {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (link.classList.contains('active')) {
          runNavInteractionFlicker(link);
          window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
          return;
        }
        menuNavLinks.forEach(clearNavFlicker);
        navigatePortfolioSection(targetSection, { history: 'push', scroll: true });
        return;
      }

      if (!link.classList.contains('active')) return;
      runNavInteractionFlicker(link);

      const currentGallerySection = getGallerySectionFromLocation(
        document.getElementById('project-gallery')?.getAttribute('data-page') || 'featured-work'
      );
      const isCurrentGalleryFilter = isGalleryPage && targetSection === currentGallerySection;
      const isCurrentExactPage = targetUrl.pathname === currentUrl.pathname &&
        targetUrl.search === currentUrl.search;

      if (isCurrentGalleryFilter || isCurrentExactPage) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    });
  });

  if (navBrand) {
    navBrand.addEventListener('mouseenter', () => runNavInteractionFlicker(navBrand));
    navBrand.addEventListener('focus', () => runNavInteractionFlicker(navBrand));
    navBrand.addEventListener('mouseleave', () => {
      nextNavFlickerToken(navBrand);
      clearNavFlicker(navBrand);
    });
    navBrand.addEventListener('blur', () => {
      nextNavFlickerToken(navBrand);
      clearNavFlicker(navBrand);
    });
    navBrand.addEventListener('click', event => {
      event.preventDefault();
      runNavInteractionFlicker(navBrand);
      const href = navBrand.getAttribute('href') || '/';
      window.setTimeout(() => {
        window.location.href = href;
      }, reducedMotion ? 0 : 112);
    });
  }

  if (document.querySelector('.nav-link.active') && !reducedMotion) {
    function scheduleNavFlicker() {
      const delay = 3800 + Math.random() * 5200;
      window.setTimeout(triggerNavFlicker, delay);
    }

    function triggerNavFlicker() {
      const activeNavLink = document.querySelector('.nav-link.active');
      if (!activeNavLink) {
        scheduleNavFlicker();
        return;
      }
      if (document.hidden || activeNavLink.matches(':hover, :focus-visible')) {
        scheduleNavFlicker();
        return;
      }

      clearNavFlicker(activeNavLink);
      const effect = flickerClasses[Math.floor(Math.random() * flickerClasses.length)];
      activeNavLink.classList.add(effect);

      const duration = effect === 'is-nav-light-dip' ? 72 : 90;
      window.setTimeout(() => {
        clearNavFlicker(activeNavLink);

        if (effect === 'is-nav-light-dip' && Math.random() > 0.45) {
          window.setTimeout(() => {
            if (!activeNavLink.classList.contains('active')) return;
            activeNavLink.classList.add('is-nav-light-flare');
            window.setTimeout(() => clearNavFlicker(activeNavLink), 48);
          }, 46);
        }
      }, duration);

      scheduleNavFlicker();
    }

    scheduleNavFlicker();
  }

  // --- Mobile Navigation Menu Toggle ---
  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      setMobileMenuOpen(!navMenu.classList.contains('open'));
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    });
    document.addEventListener('click', event => {
      if (!navMenu.classList.contains('open')) return;
      if (navMenu.contains(event.target) || navToggle.contains(event.target)) return;
      setMobileMenuOpen(false);
    });
  }

  // --- Portfolio Category Filter Bar ---
  const filterBtns = document.querySelectorAll('.filter-btn');

  if (filterBtns.length > 0) {
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.getAttribute('data-filter');
        const projectCards = document.querySelectorAll('.project-card');

        projectCards.forEach(card => {
          const category = card.getAttribute('data-category');
          if (filter === 'all' || category === filter) {
            card.style.display = 'flex';
            card.style.animation = 'fadeInUp 0.5s ease forwards';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }

  updateShadow();
});
