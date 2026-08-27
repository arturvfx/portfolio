/**
 * Global public-site settings shared by the landing, contact and footer surfaces.
 * Supabase is the public source of truth; localStorage is an immediate backup.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'portfolio-site-settings-v1';
  const DEFAULTS = Object.freeze({
    landingTitle: 'ARTUR ARAUJO',
    landingSubtitle: 'GENERALISTA VFX',
    landingEnterLabel: 'ENTRAR',
    landingWatchReelLabel: 'ASSISTIR REEL',
    landingBackgroundVideo: 'assets/videos/bg-cinema.mp4',
    workIntroTitle: 'GENERALISTA ATUANDO ENTRE MOTION, COMPOSIÇÃO VFX E EDIÇÃO.',
    workIntroBody: 'Uma seleção de projetos de efeitos visuais, motion e edição para cinema, televisão e conteúdo de marca.',
    workHeroProjectIds: [],
    galleryBackgroundVideo: 'assets/videos/bg-cinema.mp4',
    contentTheme: 'dark',
    contactTitle: 'VAMOS TRABALHAR JUNTOS',
    contactIntro: 'Disponível para produções audiovisuais, projetos de VFX e consultoria criativa.',
    contactAvailability: 'DISPONÍVEL PARA NOVOS PROJETOS',
    contactLocation: 'SÃO PAULO / REMOTO PARA TODO O MUNDO',
    contactSubmitLabel: 'ENVIAR MENSAGEM',
    contactCategoryVfx: 'VFX E COMPOSIÇÃO',
    contactCategoryEditing: 'EDIÇÃO DE CONTEÚDO',
    contactCategoryAlchemy: 'ALQUIMIA DIGITAL E SIMULAÇÃO 3D',
    contactCategoryFull: 'DIREÇÃO DE PÓS-PRODUÇÃO',
    contactCategoryOther: 'OUTRO',
    footerTitle: 'VAMOS TRABALHAR JUNTOS',
    footerContactLabel: 'CONTATO',
    footerInstagramLabel: 'INSTAGRAM',
    footerInstagramUrl: 'https://instagram.com',
    footerCopyright: '© 2026 ARTUR ARAUJO'
  });
  const LEGACY_EN_DEFAULTS = Object.freeze({
    landingSubtitle: 'VFX GENERALIST', landingEnterLabel: 'ENTER', landingWatchReelLabel: 'WATCH REEL',
    workIntroTitle: 'GENERALIST WORKING ACROSS MOTION, VFX COMPOSITING AND EDITORIAL.',
    workIntroBody: 'A selection of visual effects, motion and editing projects across film, television and branded work.',
    contactTitle: "LET'S WORK TOGETHER", contactIntro: 'Available for film productions, VFX projects and creative consulting.',
    contactAvailability: 'AVAILABLE FOR NEW PROJECTS', contactLocation: 'SÃO PAULO / REMOTE WORLDWIDE',
    contactSubmitLabel: 'SEND MESSAGE', contactCategoryVfx: 'VFX & COMPOSITING',
    contactCategoryEditing: 'CONTENT EDITING', contactCategoryAlchemy: 'DIGITAL ALCHEMY & 3D SIMULATION',
    contactCategoryFull: 'POST-PRODUCTION DIRECTION', contactCategoryOther: 'OTHER',
    footerTitle: "LET'S WORK TOGETHER", footerContactLabel: 'CONTACT'
  });
  let currentSettings = null;

  function normalizeTranslations(value) {
    const translations = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const english = translations.en && typeof translations.en === 'object' && !Array.isArray(translations.en)
      ? translations.en
      : {};
    const fields = window.portfolioI18n?.SITE_FIELDS || [];
    return {
      en: fields.reduce((result, field) => {
        if (typeof english[field] === 'string') result[field] = english[field].trim();
        return result;
      }, {})
    };
  }

  function normalize(value) {
    const source = value && typeof value === 'object' ? value : {};
    const migratedEnglish = {};
    const normalized = Object.keys(DEFAULTS).reduce((settings, key) => {
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
      const isLegacyEnglishDefault = LEGACY_EN_DEFAULTS[key] && candidate === LEGACY_EN_DEFAULTS[key];
      if (isLegacyEnglishDefault) migratedEnglish[key] = candidate;
      // These fields are intentionally optional; explicit empty strings must
      // survive local and remote normalization.
      if (['landingSubtitle', 'workIntroTitle', 'workIntroBody'].includes(key) && hasStringValue) {
        settings[key] = isLegacyEnglishDefault ? DEFAULTS[key] : candidate;
      } else if (key === 'contentTheme') {
        settings[key] = candidate === 'light' ? 'light' : 'dark';
      } else {
        settings[key] = isLegacyEnglishDefault ? DEFAULTS[key] : (candidate || DEFAULTS[key]);
      }
      return settings;
    }, {});
    normalized.translations = normalizeTranslations(source.translations);
    normalized.translations.en = { ...migratedEnglish, ...normalized.translations.en };
    return normalized;
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
    const visible = window.portfolioI18n
      ? portfolioI18n.localizeSettings(current)
      : current;
    setText('[data-site-setting="landing-title"]', visible.landingTitle, true);
    setText('[data-site-setting="landing-subtitle"]', visible.landingSubtitle, true);
    document.querySelectorAll('.brand-subtitle').forEach(element => {
      element.hidden = !visible.landingSubtitle;
    });
    document.body.classList.toggle('landing-with-subtitle', Boolean(visible.landingSubtitle));
    document.body.classList.toggle('landing-without-subtitle', !visible.landingSubtitle);
    applyThemeClasses(current);
    setText('[data-site-setting="landing-enter-label"]', visible.landingEnterLabel, true);
    setText('[data-site-setting="landing-watch-reel-label"]', visible.landingWatchReelLabel, true);
    setText('[data-site-setting="contact-title"]', visible.contactTitle, false);
    setText('[data-site-setting="contact-intro"]', visible.contactIntro, false);
    setText('[data-site-setting="contact-availability"]', visible.contactAvailability, false);
    setText('[data-site-setting="contact-location"]', visible.contactLocation, false);
    setText('[data-site-setting="contact-submit-label"]', visible.contactSubmitLabel, false);
    setText('[data-site-setting="contact-category-vfx"]', visible.contactCategoryVfx, false);
    setText('[data-site-setting="contact-category-editing"]', visible.contactCategoryEditing, false);
    setText('[data-site-setting="contact-category-alchemy"]', visible.contactCategoryAlchemy, false);
    setText('[data-site-setting="contact-category-full"]', visible.contactCategoryFull, false);
    setText('[data-site-setting="contact-category-other"]', visible.contactCategoryOther, false);
    setText('[data-site-setting="footer-title"]', visible.footerTitle, false);
    setText('[data-site-setting="footer-contact-label"]', visible.footerContactLabel, false);
    setText('[data-site-setting="footer-instagram-label"]', visible.footerInstagramLabel, false);
    setText('[data-site-setting="footer-copyright"]', visible.footerCopyright, false);

    document.querySelectorAll('[data-site-setting="footer-instagram-url"]').forEach(link => {
      link.href = safeExternalUrl(current.footerInstagramUrl);
    });

    applyVideoSource('landing-background-video', current.landingBackgroundVideo);
    if (!document.body.classList.contains('gallery-background-managed')) {
      applyVideoSource('gallery-background-video', current.galleryBackgroundVideo);
    }

    if (document.querySelector('[data-site-setting="landing-title"]')) {
      document.title = `${visible.landingTitle} | Portfolio`;
    }

    window.dispatchEvent(new CustomEvent('portfolio-site-settings-applied', {
      detail: { ...visible }
    }));
    return visible;
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
    getCurrent: () => {
      const raw = currentSettings ? { ...currentSettings } : loadLocal();
      return window.portfolioI18n ? portfolioI18n.localizeSettings(raw) : raw;
    },
    saveLocal,
    clearLocal,
    apply,
    hydrate
  };

  // The script runs in <head>. Apply the cached theme to the root before the
  // first paint so navigation never exposes the default dark canvas first.
  applyThemeClasses(loadLocal());
}());
