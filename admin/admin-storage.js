/**
 * admin/admin-storage.js
 *
 * Portfolio Admin — Data Layer
 * Responsibility: manage the override layer between source data and effective data.
 *
 * This file is safe to load on public gallery pages.
 * When no overrides exist it adds zero overhead and returns source data unchanged.
 *
 * Data Flow:
 *   Source     → PROJECTS_DATA (data/projects-data.js)
 *   Overrides  → localStorage key: portfolio-project-overrides-v1
 *   Effective  → adminStorage.getEffective(PROJECTS_DATA)
 *
 * Storage format:
 *   {
 *     "version": 1,
 *     "updatedAt": "ISO_DATE_STRING",
 *     "projects": [ ...full project array... ],
 *     "deleted": [ { "id": "...", "slug": "..." } ]
 *   }
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'portfolio-project-overrides-v1';
  const GALLERY_STORAGE_KEY = 'portfolio-gallery-overrides-v1';
  const STORAGE_VERSION = 1;
  const SUPPORTED_SIZES = ['16-9', '9-16', '4-3'];

  function normalizeCoverFocus(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 50;
  }

  function normalizeCoverScale(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(100, Math.min(200, number)) : 100;
  }

  function normalizeProjectStills(value) {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 3).map(item => {
      const source = typeof item === 'string' ? { url: item } : (item || {});
      const url = typeof source.url === 'string' ? source.url.trim() : '';
      const size = SUPPORTED_SIZES.includes(source.size) ? source.size : '16-9';
      return { url, size };
    }).filter(item => item.url);
  }

  function normalizeTranslations(value, allowedFields) {
    const translations = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const english = translations.en && typeof translations.en === 'object' && !Array.isArray(translations.en)
      ? translations.en
      : {};
    return {
      en: allowedFields.reduce((result, field) => {
        const candidate = english[field];
        if (field === 'services') {
          if (Array.isArray(candidate)) result[field] = candidate.map(item => String(item).trim()).filter(Boolean);
        } else if (typeof candidate === 'string') {
          result[field] = candidate.trim();
        }
        return result;
      }, {})
    };
  }

  function sanitizeProject(project) {
    const clean = { ...project };
    // Remove the retired credit from older local overrides during migration.
    delete clean.agencyStudio;
    clean.browserTitle = typeof clean.browserTitle === 'string' ? clean.browserTitle.trim() : '';
    clean.projectStills = normalizeProjectStills(clean.projectStills);
    clean.desktopFocusX = normalizeCoverFocus(clean.desktopFocusX);
    clean.desktopFocusY = normalizeCoverFocus(clean.desktopFocusY);
    clean.desktopCoverScale = normalizeCoverScale(clean.desktopCoverScale);
    clean.heroFocusX = normalizeCoverFocus(clean.heroFocusX);
    clean.heroFocusY = normalizeCoverFocus(clean.heroFocusY);
    clean.heroCoverScale = normalizeCoverScale(clean.heroCoverScale);
    clean.mobileFocusX = normalizeCoverFocus(clean.mobileFocusX);
    clean.mobileFocusY = normalizeCoverFocus(clean.mobileFocusY);
    clean.mobileCoverScale = normalizeCoverScale(clean.mobileCoverScale);
    clean.translations = normalizeTranslations(clean.translations, [
      'title', 'browserTitle', 'category', 'services', 'projectSummary', 'contribution'
    ]);
    return clean;
  }

  // ─── Load ────────────────────────────────────────────────────

  /**
   * Load the stored overrides payload from localStorage.
   * Returns null if nothing is stored or if the payload is malformed.
   * @returns {{ version: number, updatedAt: string, projects: Array }|null}
   */
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const payload = JSON.parse(raw);
      if (!payload || !Array.isArray(payload.projects)) return null;
      return payload;
    } catch (e) {
      console.warn('[adminStorage] Failed to parse overrides:', e);
      return null;
    }
  }

  // ─── Save ────────────────────────────────────────────────────

  /**
   * Persist the full project array as the override payload.
   * @param {Array} projects
   */
  function save(projects, deletedProjects) {
    const current = load();
    const payload = {
      version: STORAGE_VERSION,
      updatedAt: new Date().toISOString(),
      projects: projects.map(sanitizeProject),
      deleted: Array.isArray(deletedProjects)
        ? deletedProjects
        : (current && Array.isArray(current.deleted) ? current.deleted : [])
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.error('[adminStorage] Failed to save overrides:', e);
    }
  }

  // ─── Clear ───────────────────────────────────────────────────

  /**
   * Remove all local overrides. Source data becomes effective again.
   */
  function clear() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(GALLERY_STORAGE_KEY);
  }

  // ─── Gallery Sections ───────────────────────────────────────

  function loadGalleries() {
    try {
      const raw = localStorage.getItem(GALLERY_STORAGE_KEY);
      if (!raw) return null;
      const payload = JSON.parse(raw);
      return payload && Array.isArray(payload.galleries) ? payload : null;
    } catch (e) {
      console.warn('[adminStorage] Failed to parse gallery overrides:', e);
      return null;
    }
  }

  function saveGalleries(galleries, deletedGalleries) {
    const current = loadGalleries();
    const requestedDeleted = Array.isArray(deletedGalleries)
      ? deletedGalleries
      : (current && Array.isArray(current.deleted) ? current.deleted : []);
    const activeIds = new Set(galleries.map(gallery => gallery.id));
    const payload = {
      version: STORAGE_VERSION,
      updatedAt: new Date().toISOString(),
      galleries: galleries.map(gallery => ({
        ...gallery,
        slug: String(gallery.slug || gallery.id || '').trim(),
        previousSlugs: Array.isArray(gallery.previousSlugs)
          ? [...new Set(gallery.previousSlugs.map(value => String(value).trim()).filter(Boolean))]
          : [],
        browserTitle: typeof gallery.browserTitle === 'string' ? gallery.browserTitle.trim() : '',
        translations: normalizeTranslations(gallery.translations, ['title', 'browserTitle', 'description'])
      })),
      deleted: requestedDeleted.filter(id => !activeIds.has(id))
    };
    localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(payload));
  }

  function getEffectiveGalleries(sourceGalleries) {
    const overrides = loadGalleries();
    if (!overrides) return sourceGalleries.map(gallery => ({ ...gallery }));
    const deleted = new Set(Array.isArray(overrides.deleted) ? overrides.deleted : []);
    const byId = new Map(overrides.galleries.map(gallery => [gallery.id, gallery]));
    const matched = new Set();
    const merged = sourceGalleries
      .filter(gallery => !deleted.has(gallery.id))
      .map(source => {
        const override = byId.get(source.id);
        if (!override) return { ...source };
        matched.add(source.id);
        return { ...source, ...override };
      });
    overrides.galleries.forEach(gallery => {
      if (!matched.has(gallery.id) && !deleted.has(gallery.id)) merged.push({ ...gallery });
    });
    return normalizeGalleryOrder(merged);
  }

  function normalizeGalleryOrder(galleries) {
    return galleries
      .map((gallery, index) => ({ gallery, index }))
      .sort((a, b) => Number(a.gallery.order) - Number(b.gallery.order) || a.index - b.index)
      .map(({ gallery }, index) => ({ ...gallery, order: index + 1 }));
  }

  function setGalleryOrder(galleries, id, requestedOrder) {
    const ordered = normalizeGalleryOrder(galleries);
    const index = ordered.findIndex(gallery => gallery.id === id);
    if (index === -1) return ordered;
    const [moved] = ordered.splice(index, 1);
    const target = Math.max(0, Math.min(ordered.length, requestedOrder - 1));
    ordered.splice(target, 0, moved);
    return ordered.map((gallery, galleryIndex) => ({ ...gallery, order: galleryIndex + 1 }));
  }

  function deleteGallery(galleries, id) {
    const current = loadGalleries();
    const deleted = current && Array.isArray(current.deleted) ? current.deleted.slice() : [];
    if (!deleted.includes(id)) deleted.push(id);
    const remaining = normalizeGalleryOrder(galleries.filter(gallery => gallery.id !== id));
    saveGalleries(remaining, deleted);
    return remaining;
  }

  // ─── Effective Data ──────────────────────────────────────────

  /**
   * Return the effective project list.
   * Uses local overrides when available; falls back to sourceProjects.
   * Does not mutate sourceProjects.
   * @param {Array} sourceProjects - PROJECTS_DATA from projects-data.js
   * @returns {Array}
   */
  function getEffective(sourceProjects) {
    const overrides = load();
    if (!overrides) return sourceProjects.map(sanitizeProject);

    const deleted = Array.isArray(overrides.deleted) ? overrides.deleted : [];
    const isDeleted = project => deleted.some(item =>
      (item.id && project.id === item.id) ||
      (item.slug && project.slug === item.slug)
    );

    const overrideById = new Map();
    const overrideBySlug = new Map();
    overrides.projects.forEach(project => {
      if (project.id) overrideById.set(project.id, project);
      if (project.slug) overrideBySlug.set(project.slug, project);
    });

    const matchedOverrides = new Set();
    const merged = sourceProjects.filter(source => !isDeleted(source)).map(source => {
      // IDs are the stable primary key. Slugs keep older/id-less data compatible.
      const override = (source.id && overrideById.get(source.id)) ||
        (source.slug && overrideBySlug.get(source.slug));
      if (!override) return { ...source };
      matchedOverrides.add(override);
      // The override is spread last deliberately: local order and edits must win.
      return { ...source, ...override };
    });

    // Preserve locally imported projects which do not exist in source data yet.
    overrides.projects.forEach(override => {
      if (!matchedOverrides.has(override) && !isDeleted(override)) merged.push({ ...override });
    });

    return merged.map(sanitizeProject);
  }

  /** Persistently hide a project, including projects which still exist in source data. */
  function deleteProject(projects, project) {
    const current = load();
    const deleted = current && Array.isArray(current.deleted) ? current.deleted.slice() : [];
    const identity = { id: project.id || '', slug: project.slug || '' };
    const alreadyDeleted = deleted.some(item =>
      (identity.id && item.id === identity.id) ||
      (identity.slug && item.slug === identity.slug)
    );
    if (!alreadyDeleted) deleted.push(identity);

    const remaining = projects.filter(item =>
      !((identity.id && item.id === identity.id) ||
        (identity.slug && item.slug === identity.slug))
    );
    const normalized = normalizeOrder(remaining, project.section);
    save(normalized, deleted);
    return normalized;
  }

  /** Remove deletion markers for imported/restored projects and save them. */
  function restoreProjects(projects, restoredProjects) {
    const current = load();
    const deleted = current && Array.isArray(current.deleted) ? current.deleted : [];
    const remainingDeleted = deleted.filter(item => !restoredProjects.some(project =>
      (item.id && project.id === item.id) ||
      (item.slug && project.slug === item.slug)
    ));
    save(projects, remainingDeleted);
  }

  // ─── Normalize Order ─────────────────────────────────────────

  /**
   * Resequence order values for a given section to 1, 2, 3, …
   * Other sections are left untouched.
   * @param {Array} projects - Full project array
   * @param {string} section - Section to normalize
   * @returns {Array} New project array with normalized orders
   */
  function normalizeOrder(projects, section) {
    const ordered = projects
      .filter(p => p.section === section)
      .map((project, index) => ({ project, index }))
      .sort((a, b) => {
        const orderA = Number.isFinite(a.project.order) ? a.project.order : Number.MAX_SAFE_INTEGER;
        const orderB = Number.isFinite(b.project.order) ? b.project.order : Number.MAX_SAFE_INTEGER;
        return orderA - orderB || a.index - b.index;
      })
      .map(({ project }, index) => ({ ...project, order: index + 1 }));

    let next = 0;
    return projects.map(project => project.section === section ? ordered[next++] : project);
  }

  /** Place one project at a 1-based position and resequence its section. */
  function setOrder(projects, section, identity, requestedOrder) {
    const sectionProjects = projects
      .filter(p => p.section === section)
      .map((project, index) => ({ project, index }))
      .sort((a, b) => {
        const orderA = Number.isFinite(a.project.order) ? a.project.order : Number.MAX_SAFE_INTEGER;
        const orderB = Number.isFinite(b.project.order) ? b.project.order : Number.MAX_SAFE_INTEGER;
        return orderA - orderB || a.index - b.index;
      })
      .map(({ project }) => project);
    const index = sectionProjects.findIndex(p =>
      (identity.id && p.id === identity.id) ||
      (identity.slug && p.slug === identity.slug)
    );
    if (index === -1) return projects.slice();

    const [moved] = sectionProjects.splice(index, 1);
    const target = Math.max(0, Math.min(sectionProjects.length, requestedOrder - 1));
    sectionProjects.splice(target, 0, moved);
    const resequenced = sectionProjects.map((p, i) => ({ ...p, order: i + 1 }));
    let next = 0;
    return projects.map(p => p.section === section ? resequenced[next++] : p);
  }

  // ─── Validate Import ─────────────────────────────────────────

  /**
   * Validate a parsed import payload.
   * @param {*} payload - Parsed JSON value
   * @returns {string[]} Array of error messages (empty if valid)
   */
  function validate(payload) {
    const errors = [];

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      errors.push('Payload must be a JSON object.');
      return errors;
    }

    if (!Array.isArray(payload.projects)) {
      errors.push('Missing or invalid "projects" array.');
      return errors;
    }

    if (payload.projects.length === 0) {
      errors.push('"projects" array is empty.');
    }

    const seenIds = new Set();
    const seenSlugs = new Set();

    payload.projects.forEach((p, i) => {
      const ref = `Project ${i + 1}`;

      if (!p || typeof p !== 'object' || Array.isArray(p)) {
        errors.push(`${ref}: must be an object.`);
        return;
      }

      if (typeof p.id !== 'string' || !p.id.trim()) {
        errors.push(`${ref}: missing or invalid "id".`);
      } else {
        if (seenIds.has(p.id)) errors.push(`${ref}: duplicate id "${p.id}".`);
        seenIds.add(p.id);
      }
      if (typeof p.slug !== 'string' || !p.slug.trim()) {
        errors.push(`${ref}: missing or invalid "slug".`);
      } else {
        if (seenSlugs.has(p.slug)) errors.push(`${ref}: duplicate slug "${p.slug}".`);
        seenSlugs.add(p.slug);
      }

      if (typeof p.title !== 'string' || !p.title.trim()) errors.push(`${ref}: missing or invalid "title".`);
      if (typeof p.section !== 'string' || !p.section.trim()) errors.push(`${ref}: missing or invalid "section".`);
      if (p.coverImage != null && typeof p.coverImage !== 'string') {
        errors.push(`${ref}: "coverImage" must be a string.`);
      }
      ['desktopFocusX', 'desktopFocusY', 'heroFocusX', 'heroFocusY', 'mobileFocusX', 'mobileFocusY'].forEach(field => {
        if (p[field] != null && (typeof p[field] !== 'number' || !Number.isFinite(p[field]) || p[field] < 0 || p[field] > 100)) {
          errors.push(`${ref}: "${field}" must be a number from 0 to 100.`);
        }
      });
      ['desktopCoverScale', 'heroCoverScale', 'mobileCoverScale'].forEach(field => {
        if (p[field] != null && (
          typeof p[field] !== 'number' ||
          !Number.isFinite(p[field]) ||
          p[field] < 100 ||
          p[field] > 200
        )) {
          errors.push(`${ref}: "${field}" must be a number from 100 to 200.`);
        }
      });
      if (p.previewVideo != null && typeof p.previewVideo !== 'string') {
        errors.push(`${ref}: "previewVideo" must be a string.`);
      }
      if (p.youtubeUrl != null && typeof p.youtubeUrl !== 'string') {
        errors.push(`${ref}: "youtubeUrl" must be a string.`);
      }
      if (p.services != null && (!Array.isArray(p.services) || p.services.some(item => typeof item !== 'string'))) {
        errors.push(`${ref}: "services" must be an array of strings.`);
      }
      if (p.translations != null && (typeof p.translations !== 'object' || Array.isArray(p.translations))) {
        errors.push(`${ref}: "translations" must be an object.`);
      }
      if (p.projectStills != null) {
        if (!Array.isArray(p.projectStills)) {
          errors.push(`${ref}: "projectStills" must be an array.`);
        } else {
          if (p.projectStills.length > 3) errors.push(`${ref}: "projectStills" accepts at most 3 images.`);
          p.projectStills.forEach((still, stillIndex) => {
            if (!still || typeof still !== 'object' || typeof still.url !== 'string') {
              errors.push(`${ref}: project still ${stillIndex + 1} must contain a string "url".`);
            } else if (!SUPPORTED_SIZES.includes(still.size)) {
              errors.push(`${ref}: project still ${stillIndex + 1} has an invalid "size".`);
            }
          });
        }
      }
      ['projectSummary', 'contribution', 'director', 'productionCompany', 'watchNowUrl'].forEach(field => {
        if (p[field] != null && typeof p[field] !== 'string') {
          errors.push(`${ref}: "${field}" must be a string.`);
        }
      });
      if (p.watchNowEnabled != null && typeof p.watchNowEnabled !== 'boolean') {
        errors.push(`${ref}: "watchNowEnabled" must be a boolean.`);
      }
      if (!Number.isInteger(p.order) || p.order < 1) {
        errors.push(`${ref}: "order" must be a whole number greater than 0.`);
      }
      if (typeof p.published !== 'boolean') errors.push(`${ref}: "published" must be a boolean.`);
      if (!SUPPORTED_SIZES.includes(p.size)) {
        errors.push(`${ref}: "size" must be one of: ${SUPPORTED_SIZES.join(', ')}. Got: "${p.size}".`);
      }
    });

    return errors;
  }

  // ─── Full-site backup ────────────────────────────────────────

  function addMediaReference(manifest, url, reference) {
    const source = typeof url === 'string' ? url.trim() : '';
    if (!source) return;
    const existing = manifest.get(source) || { url: source, references: [] };
    if (!existing.references.includes(reference)) existing.references.push(reference);
    manifest.set(source, existing);
  }

  function collectMediaManifest(galleries, projects, settings) {
    const manifest = new Map();
    addMediaReference(manifest, settings?.landingBackgroundVideo, 'site.landingBackgroundVideo');
    addMediaReference(manifest, settings?.galleryBackgroundVideo, 'site.galleryBackgroundVideo');

    (galleries || []).forEach(gallery => {
      addMediaReference(manifest, gallery.backgroundVideo, `section.${gallery.id}.backgroundVideo`);
    });

    (projects || []).forEach(project => {
      const identity = project.id || project.slug || 'unknown';
      addMediaReference(manifest, project.coverImage, `project.${identity}.coverImage`);
      addMediaReference(manifest, project.previewVideo, `project.${identity}.previewVideo`);
      normalizeProjectStills(project.projectStills).forEach((still, index) => {
        addMediaReference(manifest, still.url, `project.${identity}.projectStills.${index}`);
      });
    });

    return Array.from(manifest.values()).map((entry, index) => ({
      id: index + 1,
      ...entry
    }));
  }

  function createFullBackup(galleries, projects, settings) {
    const cleanGalleries = (galleries || []).map(gallery => ({
      ...gallery,
      previousSlugs: Array.isArray(gallery.previousSlugs) ? [...gallery.previousSlugs] : [],
      translations: normalizeTranslations(gallery.translations, ['title', 'browserTitle', 'description'])
    }));
    const cleanProjects = (projects || []).map(sanitizeProject);
    const cleanSettings = settings && typeof settings === 'object'
      ? JSON.parse(JSON.stringify(settings))
      : {};
    const media = collectMediaManifest(cleanGalleries, cleanProjects, cleanSettings);

    return {
      backupType: 'artur-portfolio-full',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      source: window.location.origin,
      counts: {
        sections: cleanGalleries.length,
        projects: cleanProjects.length,
        media: media.length
      },
      settings: cleanSettings,
      galleries: cleanGalleries,
      projects: cleanProjects,
      media,
      recoveryNote: 'Media files are listed by URL. Run the repository media-backup script while those URLs are still available to keep offline copies.'
    };
  }

  function downloadJson(payload, filename) {
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportFullBackup(galleries, projects, settings) {
    const payload = createFullBackup(galleries, projects, settings);
    const date = payload.exportedAt.slice(0, 10);
    downloadJson(payload, `artur-portfolio-backup-${date}.json`);
    return payload;
  }

  function validateFullBackup(payload) {
    const errors = [];
    if (!payload || payload.backupType !== 'artur-portfolio-full') {
      return ['This is not a full portfolio backup.'];
    }
    if (!Array.isArray(payload.galleries)) errors.push('"galleries" must be an array.');
    if (!Array.isArray(payload.projects)) errors.push('"projects" must be an array.');
    if (!payload.settings || typeof payload.settings !== 'object' || Array.isArray(payload.settings)) {
      errors.push('"settings" must be an object.');
    }
    if (errors.length) return errors;

    errors.push(...validate({ projects: payload.projects }));
    const galleryIds = new Set();
    const gallerySlugs = new Set();
    payload.galleries.forEach((gallery, index) => {
      const ref = `Section ${index + 1}`;
      if (!gallery || typeof gallery !== 'object') {
        errors.push(`${ref} must be an object.`);
        return;
      }
      if (!gallery.id || typeof gallery.id !== 'string') errors.push(`${ref} requires a string "id".`);
      if (!gallery.slug || typeof gallery.slug !== 'string') errors.push(`${ref} requires a string "slug".`);
      if (!gallery.title || typeof gallery.title !== 'string') errors.push(`${ref} requires a string "title".`);
      if (galleryIds.has(gallery.id)) errors.push(`${ref} duplicates internal ID "${gallery.id}".`);
      if (gallerySlugs.has(gallery.slug)) errors.push(`${ref} duplicates URL slug "${gallery.slug}".`);
      galleryIds.add(gallery.id);
      gallerySlugs.add(gallery.slug);
    });
    payload.projects.forEach((project, index) => {
      if (!galleryIds.has(project.section)) {
        errors.push(`Project ${index + 1} references missing section "${project.section}".`);
      }
    });
    return errors;
  }

  // ─── Public API ──────────────────────────────────────────────

  window.ADMIN_STORAGE_KEY = STORAGE_KEY;
  window.ADMIN_GALLERY_STORAGE_KEY = GALLERY_STORAGE_KEY;
  window.SUPPORTED_SIZES = SUPPORTED_SIZES;
  window.normalizeProjectStills = normalizeProjectStills;

  window.adminStorage = {
    load,
    save,
    clear,
    loadGalleries,
    saveGalleries,
    getEffectiveGalleries,
    normalizeGalleryOrder,
    setGalleryOrder,
    deleteGallery,
    getEffective,
    deleteProject,
    restoreProjects,
    normalizeOrder,
    setOrder,
    validate,
    collectMediaManifest,
    createFullBackup,
    exportFullBackup,
    validateFullBackup
  };

}());
