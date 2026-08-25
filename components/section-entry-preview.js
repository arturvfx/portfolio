/**
 * Fast landing-to-gallery handoff.
 * Preloads the first published section hero and stores a short-lived snapshot
 * in sessionStorage so the destination can paint media before Supabase finishes.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'portfolio-section-entry-preview-v1';
  const MAX_AGE = 10 * 60 * 1000;
  const pending = new Map();

  function normalizeFocus(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 50;
  }

  function normalizeScale(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(100, Math.min(200, number)) : 100;
  }

  function normalizeStills(value) {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 3).map(item => {
      const source = typeof item === 'string' ? { url: item } : (item || {});
      return { url: typeof source.url === 'string' ? source.url.trim() : '', size: source.size || '16-9' };
    }).filter(item => item.url);
  }

  function galleryFromRow(row) {
    return {
      id: row.id,
      title: row.title,
      description: row.description || '',
      published: row.published !== false,
      order: Number(row.display_order),
      backgroundEnabled: row.background_enabled !== false,
      backgroundSource: ['default', 'homepage', 'custom'].includes(row.background_source)
        ? row.background_source
        : 'default',
      backgroundVideo: row.background_video || '',
      heroEnabled: row.hero_enabled === true
    };
  }

  function projectFromRow(row) {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      category: row.category || '',
      coverImage: row.cover_image || '',
      previewVideo: row.preview_video || '',
      projectStills: normalizeStills(row.project_stills),
      section: row.section_id,
      size: row.size || '16-9',
      published: row.published !== false,
      order: Number(row.display_order),
      mobileFocusX: normalizeFocus(row.mobile_focus_x),
      mobileFocusY: normalizeFocus(row.mobile_focus_y),
      mobileCoverScale: normalizeScale(row.mobile_cover_scale)
    };
  }

  function getFirstMedia(project) {
    if (project.coverImage) return { type: 'image', url: project.coverImage };
    if (project.projectStills[0]?.url) return { type: 'image', url: project.projectStills[0].url };
    if (project.previewVideo) return { type: 'video', url: project.previewVideo };
    return null;
  }

  function preloadMedia(media) {
    if (!media?.url) return Promise.resolve(false);
    return new Promise(resolve => {
      let settled = false;
      const finish = result => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        resolve(result);
      };
      const timeoutId = window.setTimeout(() => finish(false), 6000);

      if (media.type === 'video') {
        const video = document.createElement('video');
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;
        video.addEventListener('canplay', () => finish(true), { once: true });
        video.addEventListener('error', () => finish(false), { once: true });
        video.src = media.url;
        video.load();
        return;
      }

      const image = new Image();
      image.addEventListener('load', () => finish(true), { once: true });
      image.addEventListener('error', () => finish(false), { once: true });
      image.src = media.url;
      if (image.complete && image.naturalWidth) finish(true);
    });
  }

  function save(preview) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(preview));
    } catch (error) {
      // The black loading fallback still works if session storage is blocked.
    }
  }

  function read(sectionId) {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const preview = JSON.parse(raw);
      const fresh = Number(preview.savedAt) > Date.now() - MAX_AGE;
      return preview.sectionId === sectionId && fresh ? preview : null;
    } catch (error) {
      return null;
    }
  }

  async function requestRows(table, params) {
    const config = window.SUPABASE_CONFIG || {};
    if (!config.url || !config.publishableKey || !window.fetch) return [];
    const query = new URLSearchParams(params);
    const response = await fetch(`${config.url.replace(/\/$/, '')}/rest/v1/${table}?${query}`, {
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${config.publishableKey}`
      }
    });
    if (!response.ok) throw new Error(`Entry preview request failed (${response.status}).`);
    return response.json();
  }

  async function fetchPreview(sectionId) {
    const [sectionRows, projectRows] = await Promise.all([
      requestRows('portfolio_sections', {
        select: 'id,title,description,published,display_order,background_enabled,background_source,background_video,hero_enabled',
        id: `eq.${sectionId}`,
        published: 'eq.true',
        limit: '1'
      }),
      requestRows('portfolio_projects', {
        select: 'id,slug,title,category,cover_image,preview_video,project_stills,section_id,size,published,display_order,mobile_focus_x,mobile_focus_y,mobile_cover_scale',
        section_id: `eq.${sectionId}`,
        published: 'eq.true',
        order: 'display_order.asc',
        limit: '3'
      })
    ]);
    const gallery = sectionRows[0] ? galleryFromRow(sectionRows[0]) : null;
    if (!gallery || !gallery.heroEnabled) return null;
    const projects = projectRows.map(projectFromRow);
    if (!projects.length) return null;

    const mediaReady = await preloadMedia(getFirstMedia(projects[0]));
    if (!mediaReady) return null;
    const preview = { sectionId, gallery, projects, savedAt: Date.now() };
    save(preview);
    return preview;
  }

  function preload(sectionId = 'featured-work') {
    const stored = read(sectionId);
    if (stored) {
      preloadMedia(getFirstMedia(stored.projects[0]));
      return Promise.resolve(stored);
    }
    if (!pending.has(sectionId)) {
      pending.set(sectionId, fetchPreview(sectionId)
        .catch(error => {
          console.warn('Could not preload the section entry; using the black loading fallback.', error);
          return null;
        })
        .finally(() => pending.delete(sectionId)));
    }
    return pending.get(sectionId);
  }

  window.sectionEntryPreview = { preload, read };
}());
