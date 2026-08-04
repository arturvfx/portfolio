document.addEventListener('DOMContentLoaded', () => {
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
    let startTime = performance.now();
    let isHovered = false;

    enterBtn.addEventListener('mouseenter', () => { isHovered = true; resetFlickerState(); });
    enterBtn.addEventListener('mouseleave', () => { isHovered = false; });

    // 1. Continuous Organic Gate-Weave / Lens Micro-Drift (Non-periodic trigonometric superposition)
    function animateEnterDrift(time) {
      const elapsed = (time - startTime) * 0.001;
      
      // Superposition of non-harmonic sine waves creates a natural, organic drift pattern
      const dx = Math.sin(elapsed * 0.7) * 0.25 + Math.cos(elapsed * 1.3) * 0.15;
      const dy = Math.cos(elapsed * 0.9) * 0.3 + Math.sin(elapsed * 1.7) * 0.1;
      
      enterBtn.style.setProperty('--btn-drift-x', `${dx.toFixed(3)}px`);
      enterBtn.style.setProperty('--btn-drift-y', `${dy.toFixed(3)}px`);

      requestAnimationFrame(animateEnterDrift);
    }
    requestAnimationFrame(animateEnterDrift);

    // 2. Non-Periodic Imperceptible Projector Flicker Bursts
    function triggerFlicker() {
      if (document.hidden) {
        scheduleNextFlicker();
        return;
      }

      // Random selection of projector artifact types
      const flickerType = Math.floor(Math.random() * 4);
      
      // Organic pulse durations (milliseconds) & ultra-subtle visual parameter shifts
      if (flickerType === 0) {
        // Type 0: Subtle shutter light dip (opacity drops ~0.08, slight focus softness)
        applyFlickerState({ op: -0.09, blur: '0.75px', y: '0.3px' });
        setTimeout(() => resetFlickerState(), 70 + Math.random() * 40);

      } else if (flickerType === 1) {
        // Type 1: Rapid double flutter (shutter flutter)
        applyFlickerState({ op: -0.07, blur: '0.65px', x: '-0.2px' });
        setTimeout(() => {
          resetFlickerState();
          setTimeout(() => {
            applyFlickerState({ op: -0.11, blur: '0.8px', x: '0.3px', chroma: '0.4px' });
            setTimeout(() => resetFlickerState(), 50);
          }, 40 + Math.random() * 30);
        }, 60);

      } else if (flickerType === 2) {
        // Type 2: Lens optic chromatic refraction twitch
        applyFlickerState({ chroma: '0.6px', blur: '0.6px', x: '0.2px' });
        setTimeout(() => resetFlickerState(), 80 + Math.random() * 30);

      } else {
        // Type 3: Voltage micro-bump / light flash (tiny brightness surge)
        applyFlickerState({ op: 0.06, blur: '0.35px', y: '-0.2px' });
        setTimeout(() => resetFlickerState(), 60 + Math.random() * 30);
      }

      scheduleNextFlicker();
    }

    function applyFlickerState({ op = 0, blur = '0.5px', x = '0px', y = '0px', chroma = '0px' }) {
      if (isHovered) return; // Maintain crisp focus during hover interaction
      enterBtn.style.setProperty('--btn-flicker-op', `${op}`);
      enterBtn.style.setProperty('--btn-blur', blur);
      enterBtn.style.setProperty('--btn-flicker-x', x);
      enterBtn.style.setProperty('--btn-flicker-y', y);
      enterBtn.style.setProperty('--chroma-shift', chroma);
    }

    function resetFlickerState() {
      enterBtn.style.setProperty('--btn-flicker-op', '0');
      enterBtn.style.setProperty('--btn-blur', isHovered ? '0px' : '0.5px');
      enterBtn.style.setProperty('--btn-flicker-x', '0px');
      enterBtn.style.setProperty('--btn-flicker-y', '0px');
      enterBtn.style.setProperty('--chroma-shift', '0px');
    }

    function scheduleNextFlicker() {
      // Non-periodic randomized timing between 2.5 and 6.5 seconds
      const nextDelay = 2500 + Math.random() * 4000;
      setTimeout(triggerFlicker, nextDelay);
    }

    // Initialize first flicker burst after brief landing delay
    setTimeout(scheduleNextFlicker, 2000);

    // Mechanical Shutter Click & Page Navigation Handling for ENTER
    enterBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetUrl = enterBtn.getAttribute('href') || 'featured-work.html';

      document.body.classList.add('shutter-click-active');

      setTimeout(() => {
        document.body.classList.add('page-transition-out');
        setTimeout(() => {
          window.location.href = targetUrl;
        }, 300);
      }, 260);
    });
  }

  // --- Smooth Inter-Page Transitions for Navigation Links ---
  const navLinks = document.querySelectorAll('.nav-link, .nav-brand');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (!href || href === '#' || href.startsWith('mailto:') || link.target === '_blank') return;
      
      const currentPath = window.location.pathname.split('/').pop() || 'index.html';
      if (href === currentPath) {
        e.preventDefault();
        return;
      }

      e.preventDefault();
      document.body.classList.add('shutter-click-active');
      setTimeout(() => {
        document.body.classList.add('page-transition-out');
        setTimeout(() => {
          window.location.href = href;
        }, 300);
      }, 200);
    });
  });

  // --- Mobile Navigation Menu Toggle ---
  const navToggle = document.getElementById('nav-toggle');
  const navMenu = document.getElementById('nav-menu');
  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      navMenu.classList.toggle('open');
    });
  }

  // --- Portfolio Category Filter Bar ---
  const filterBtns = document.querySelectorAll('.filter-btn');
  const projectCards = document.querySelectorAll('.project-card');

  if (filterBtns.length > 0 && projectCards.length > 0) {
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.getAttribute('data-filter');

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
