/**
 * Global public-site settings shared by the landing, contact and footer surfaces.
 * Supabase is the public source of truth; localStorage is an immediate backup.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'portfolio-site-settings-v1';
  const DEFAULTS = Object.freeze({
    landingTitle: 'ARTUR ARAUJO',
    landingSubtitle: 'VFX GENERALIST',
    landingEnterLabel: 'ENTER',
    landingWatchReelLabel: 'WATCH REEL',
    landingBackgroundVideo: 'assets/videos/bg-cinema.mp4',
    workIntroTitle: 'GENERALIST WORKING ACROSS MOTION, VFX COMPOSITING AND EDITORIAL.',
    workIntroBody: 'A selection of visual effects, motion and editing projects across film, television and branded work.',
    workHeroProjectIds: [],
    galleryBackgroundVideo: 'assets/videos/bg-cinema.mp4',
    contentTheme: 'dark',
    contactTitle: "LET'S WORK TOGETHER",
    contactIntro: 'Available for film productions, VFX projects and creative consulting.',
    contactAvailability: 'AVAILABLE FOR NEW PROJECTS',
    contactLocation: 'SÃO PAULO / REMOTE WORLDWIDE',
    contactSubmitLabel: 'SEND MESSAGE',
    contactCategoryVfx: 'VFX & COMPOSITING',
    contactCategoryEditing: 'CONTENT EDITING',
    contactCategoryAlchemy: 'DIGITAL ALCHEMY & 3D SIMULATION',
    contactCategoryFull: 'POST-PRODUCTION DIRECTION',
    contactCategoryOther: 'OTHER',
    footerTitle: "LET'S WORK TOGETHER",
    footerContactLabel: 'CONTACT',
    footerInstagramLabel: 'INSTAGRAM',
    footerInstagramUrl: 'https://instagram.com',
    footerCopyright: '© 2026 ARTUR ARAUJO'
  });
  let currentSettings = null;

  function normalize(value) {
    const source = value && typeof value === 'object' ? value : {};
    return Object.keys(DEFAULTS).reduce((settings, key) => {
      if (key === 'workHeroProjectIds') {
        const identities = Array.isArray(source[key]) ? source[key] : DEFAULTS[key];
        settings[key] = [...new Set(identities
          .filter(identity => typeof identity === 'string')
          .map(identity => identity.trim())
          .filter(Boolean))].slice(0, 3);
        return settings;
      }
      const hasStringValue = typeof source[key] === 'string';
      const candidate = hasStringValue ? source[key].trim() : '';
      // These fields are intentionally optional; explicit empty strings must
      // survive local and remote normalization.
      if (['landingSubtitle', 'workIntroTitle', 'workIntroBody'].includes(key) && hasStringValue) {
        settings[key] = candidate;
      } else if (key === 'contentTheme') {
        settings[key] = candidate === 'light' ? 'light' : 'dark';
      } else {
        settings[key] = candidate || DEFAULTS[key];
      }
      return settings;
    }, {});
  }

  function loadLocal() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? normalize(JSON.parse(raw)) : normalize(DEFAULTS);
    } catch (error) {
      return normalize(DEFAULTS);
    }
  }

  function saveLocal(settings) {
    const normalized = normalize(settings);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (error) {
      // Public rendering still works from the in-memory value.
    }
    return normalized;
  }

  function clearLocal() {
    window.localStorage.removeItem(STORAGE_KEY);
  }

  function applyThemeClasses(settings) {
    const isLight = settings.contentTheme === 'light';
    document.documentElement.classList.toggle('site-content-light', isLight);
    document.documentElement.classList.toggle('site-content-dark', !isLight);
    if (!document.body) return;
    document.body.classList.toggle('site-content-light', isLight);
    document.body.classList.toggle('site-content-dark', !isLight);
  }

  function setText(selector, value, syncDataText) {
    document.querySelectorAll(selector).forEach(element => {
      element.textContent = value;
      if (syncDataText) element.setAttribute('data-text', value);
    });
  }

  function safeExternalUrl(value) {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) ? url.toString() : DEFAULTS.footerInstagramUrl;
    } catch (error) {
      return DEFAULTS.footerInstagramUrl;
    }
  }

  function apply(settings) {
    const current = normalize(settings);
    currentSettings = current;
    setText('[data-site-setting="landing-title"]', current.landingTitle, true);
    setText('[data-site-setting="landing-subtitle"]', current.landingSubtitle, true);
    document.querySelectorAll('.brand-subtitle').forEach(element => {
      element.hidden = !current.landingSubtitle;
    });
    document.body.classList.toggle('landing-with-subtitle', Boolean(current.landingSubtitle));
    document.body.classList.toggle('landing-without-subtitle', !current.landingSubtitle);
    applyThemeClasses(current);
    setText('[data-site-setting="landing-enter-label"]', current.landingEnterLabel, true);
    setText('[data-site-setting="landing-watch-reel-label"]', current.landingWatchReelLabel, true);
    setText('[data-site-setting="contact-title"]', current.contactTitle, false);
    setText('[data-site-setting="contact-intro"]', current.contactIntro, false);
    setText('[data-site-setting="contact-availability"]', current.contactAvailability, false);
    setText('[data-site-setting="contact-location"]', current.contactLocation, false);
    setText('[data-site-setting="contact-submit-label"]', current.contactSubmitLabel, false);
    setText('[data-site-setting="contact-category-vfx"]', current.contactCategoryVfx, false);
    setText('[data-site-setting="contact-category-editing"]', current.contactCategoryEditing, false);
    setText('[data-site-setting="contact-category-alchemy"]', current.contactCategoryAlchemy, false);
    setText('[data-site-setting="contact-category-full"]', current.contactCategoryFull, false);
    setText('[data-site-setting="contact-category-other"]', current.contactCategoryOther, false);
    setText('[data-site-setting="footer-title"]', current.footerTitle, false);
    setText('[data-site-setting="footer-contact-label"]', current.footerContactLabel, false);
    setText('[data-site-setting="footer-instagram-label"]', current.footerInstagramLabel, false);
    setText('[data-site-setting="footer-copyright"]', current.footerCopyright, false);

    document.querySelectorAll('[data-site-setting="footer-instagram-url"]').forEach(link => {
      link.href = safeExternalUrl(current.footerInstagramUrl);
    });

    applyVideoSource('landing-background-video', current.landingBackgroundVideo);
    if (!document.body.classList.contains('gallery-background-managed')) {
      applyVideoSource('gallery-background-video', current.galleryBackgroundVideo);
    }

    if (document.querySelector('[data-site-setting="landing-title"]')) {
      document.title = `${current.landingTitle} | Portfolio`;
    }

    window.dispatchEvent(new CustomEvent('portfolio-site-settings-applied', {
      detail: { ...current }
    }));
    return current;
  }

  function applyVideoSource(settingName, value) {
    const videoSource = document.querySelector(`[data-site-setting="${settingName}"]`);
    if (!videoSource || videoSource.getAttribute('src') === value) return;
    videoSource.setAttribute('src', value);
    videoSource.setAttribute(
      'type',
      value.toLowerCase().split('?')[0].endsWith('.webm') ? 'video/webm' : 'video/mp4'
    );
    const video = videoSource.closest('video');
    if (video) video.load();
  }

  async function loadRemote() {
    const config = window.SUPABASE_CONFIG || {};
    if (!config.url || !config.publishableKey || !window.fetch) return null;
    const endpoint = `${config.url.replace(/\/$/, '')}/rest/v1/portfolio_site_settings` +
      '?select=settings&id=eq.global';
    const response = await fetch(endpoint, {
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${config.publishableKey}`
      }
    });
    if (!response.ok) throw new Error(`Site settings request failed (${response.status}).`);
    const rows = await response.json();
    return rows[0] && rows[0].settings ? normalize(rows[0].settings) : null;
  }

  async function hydrate() {
    let current = apply(loadLocal());
    try {
      const remote = await loadRemote();
      if (remote) current = apply(saveLocal(remote));
    } catch (error) {
      console.warn('Could not load remote site settings; using local defaults.', error);
    } finally {
      document.body.classList.remove('site-settings-loading');
      document.body.classList.add('site-settings-ready');
    }
    return current;
  }

  window.SITE_SETTINGS_DEFAULTS = DEFAULTS;
  window.siteSettings = {
    STORAGE_KEY,
    normalize,
    loadLocal,
    getCurrent: () => currentSettings ? { ...currentSettings } : loadLocal(),
    saveLocal,
    clearLocal,
    apply,
    hydrate
  };

  // The script runs in <head>. Apply the cached theme to the root before the
  // first paint so navigation never exposes the default dark canvas first.
  applyThemeClasses(loadLocal());
}());
