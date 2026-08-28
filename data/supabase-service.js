(function () {
  'use strict';

  let client = null;
  const PROJECT_STILL_SIZES = ['16-9', '9-16', '4-3'];

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
      return {
        url,
        size: PROJECT_STILL_SIZES.includes(source.size) ? source.size : '16-9'
      };
    }).filter(item => item.url);
  }

  function hasCredentials() {
    const config = window.SUPABASE_CONFIG || {};
    return Boolean(config.url && config.publishableKey);
  }

  function isConfigured() {
    return Boolean(hasCredentials() && window.supabase && window.supabase.createClient);
  }

  function getClient() {
    if (!isConfigured()) return null;
    if (!client) {
      client = window.supabase.createClient(
        window.SUPABASE_CONFIG.url,
        window.SUPABASE_CONFIG.publishableKey
      );
    }
    return client;
  }

  function galleryFromRow(row) {
    const backgroundSource = ['default', 'homepage', 'custom'].includes(row.background_source)
      ? row.background_source
      : 'default';
    return {
      id: row.id,
      title: row.title,
      description: row.description || '',
      published: row.published,
      order: row.display_order,
      backgroundEnabled: row.background_enabled !== false,
      backgroundSource,
      backgroundVideo: row.background_video || '',
      translations: row.translations && typeof row.translations === 'object' ? row.translations : { en: {} }
    };
  }

  function galleryToRow(gallery) {
    return {
      id: gallery.id,
      title: gallery.title,
      description: gallery.description || '',
      published: gallery.published !== false,
      display_order: Number(gallery.order),
      background_enabled: gallery.backgroundEnabled !== false,
      background_source: ['default', 'homepage', 'custom'].includes(gallery.backgroundSource)
        ? gallery.backgroundSource
        : 'default',
      background_video: gallery.backgroundVideo || '',
      translations: gallery.translations && typeof gallery.translations === 'object' ? gallery.translations : { en: {} },
      // Kept in the row for compatibility with the existing schema. Section
      // heroes were replaced by the single global Work Overview hero.
      hero_enabled: false
    };
  }

  function projectFromRow(row) {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      client: row.client || '',
      category: row.category || '',
      year: row.year || '',
      services: Array.isArray(row.services) ? row.services : [],
      projectSummary: row.project_summary || '',
      contribution: row.contribution || '',
      director: row.director || '',
      productionCompany: row.production_company || '',
      watchNowEnabled: row.watch_now_enabled === true,
      watchNowUrl: row.watch_now_url || '',
      coverImage: row.cover_image || '',
      desktopFocusX: normalizeCoverFocus(row.desktop_focus_x),
      desktopFocusY: normalizeCoverFocus(row.desktop_focus_y),
      desktopCoverScale: normalizeCoverScale(row.desktop_cover_scale),
      heroFocusX: normalizeCoverFocus(row.hero_focus_x),
      heroFocusY: normalizeCoverFocus(row.hero_focus_y),
      heroCoverScale: normalizeCoverScale(row.hero_cover_scale),
      mobileFocusX: normalizeCoverFocus(row.mobile_focus_x),
      mobileFocusY: normalizeCoverFocus(row.mobile_focus_y),
      mobileCoverScale: normalizeCoverScale(row.mobile_cover_scale),
      previewVideo: row.preview_video || '',
      youtubeUrl: row.youtube_url || '',
      projectStills: normalizeProjectStills(row.project_stills),
      section: row.section_id,
      size: row.size,
      published: row.published,
      order: row.display_order,
      translations: row.translations && typeof row.translations === 'object' ? row.translations : { en: {} }
    };
  }

  function projectToRow(project) {
    return {
      id: project.id,
      slug: project.slug,
      title: project.title,
      client: project.client || '',
      category: project.category || '',
      year: String(project.year || ''),
      services: Array.isArray(project.services) ? project.services : [],
      project_summary: project.projectSummary || '',
      contribution: project.contribution || '',
      director: project.director || '',
      production_company: project.productionCompany || '',
      watch_now_enabled: project.watchNowEnabled === true,
      watch_now_url: project.watchNowUrl || '',
      cover_image: project.coverImage || '',
      desktop_focus_x: normalizeCoverFocus(project.desktopFocusX),
      desktop_focus_y: normalizeCoverFocus(project.desktopFocusY),
      desktop_cover_scale: normalizeCoverScale(project.desktopCoverScale),
      hero_focus_x: normalizeCoverFocus(project.heroFocusX),
      hero_focus_y: normalizeCoverFocus(project.heroFocusY),
      hero_cover_scale: normalizeCoverScale(project.heroCoverScale),
      mobile_focus_x: normalizeCoverFocus(project.mobileFocusX),
      mobile_focus_y: normalizeCoverFocus(project.mobileFocusY),
      mobile_cover_scale: normalizeCoverScale(project.mobileCoverScale),
      preview_video: project.previewVideo || '',
      youtube_url: project.youtubeUrl || '',
      project_stills: normalizeProjectStills(project.projectStills),
      section_id: project.section,
      size: project.size,
      published: project.published !== false,
      display_order: Number(project.order),
      translations: project.translations && typeof project.translations === 'object' ? project.translations : { en: {} }
    };
  }

  async function loadPortfolio(options) {
    const supabaseClient = getClient();
    if (!supabaseClient) return null;
    const includeDrafts = Boolean(options && options.includeDrafts);

    let galleriesQuery = supabaseClient
      .from('portfolio_sections')
      .select('*')
      .order('display_order', { ascending: true });
    let projectsQuery = supabaseClient
      .from('portfolio_projects')
      .select('*')
      .order('display_order', { ascending: true });

    if (!includeDrafts) {
      galleriesQuery = galleriesQuery.eq('published', true);
      projectsQuery = projectsQuery.eq('published', true);
    }

    const [galleriesResult, projectsResult] = await Promise.all([galleriesQuery, projectsQuery]);
    if (galleriesResult.error) throw galleriesResult.error;
    if (projectsResult.error) throw projectsResult.error;

    return {
      galleries: galleriesResult.data.map(galleryFromRow),
      projects: projectsResult.data.map(projectFromRow)
    };
  }

  async function loadSiteSettings() {
    const supabaseClient = getClient();
    if (!supabaseClient) return null;
    const result = await supabaseClient
      .from('portfolio_site_settings')
      .select('settings')
      .eq('id', 'global')
      .maybeSingle();
    if (result.error) throw result.error;
    return result.data && result.data.settings
      ? (window.siteSettings ? siteSettings.normalize(result.data.settings) : result.data.settings)
      : null;
  }

  async function saveSiteSettings(settings) {
    const supabaseClient = getClient();
    if (!supabaseClient) throw new Error('Supabase is not configured.');
    const normalized = window.siteSettings ? siteSettings.normalize(settings) : settings;
    const result = await supabaseClient
      .from('portfolio_site_settings')
      .upsert({ id: 'global', settings: normalized }, { onConflict: 'id' });
    if (result.error) throw result.error;
    return normalized;
  }

  async function signIn(email, password) {
    const supabaseClient = getClient();
    if (!supabaseClient) throw new Error('Supabase is not configured.');
    const result = await supabaseClient.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    return result.data;
  }

  async function signOut() {
    const supabaseClient = getClient();
    if (!supabaseClient) return;
    const result = await supabaseClient.auth.signOut();
    if (result.error) throw result.error;
  }

  async function getSession() {
    const supabaseClient = getClient();
    if (!supabaseClient) return null;
    const result = await supabaseClient.auth.getSession();
    if (result.error) throw result.error;
    return result.data.session;
  }

  async function isAdmin() {
    const supabaseClient = getClient();
    if (!supabaseClient) return false;
    const session = await getSession();
    if (!session) return false;
    const result = await supabaseClient
      .from('portfolio_admins')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (result.error) throw result.error;
    return Boolean(result.data);
  }

  async function importPortfolio(galleries, projects) {
    const supabaseClient = getClient();
    if (!supabaseClient) throw new Error('Supabase is not configured.');
    const galleryRows = (galleries || []).map(galleryToRow);
    const projectRows = (projects || []).map(projectToRow);
    const galleryIds = new Set(galleryRows.map(row => row.id));
    const invalidProjects = projectRows.filter(row => !galleryIds.has(row.section_id));

    if (invalidProjects.length) {
      throw new Error(
        `Some projects reference a missing section: ${invalidProjects.map(row => row.title).join(', ')}`
      );
    }

    if (galleryRows.length) {
      const galleriesResult = await supabaseClient
        .from('portfolio_sections')
        .upsert(galleryRows, { onConflict: 'id' });
      if (galleriesResult.error) throw galleriesResult.error;
    }

    if (projectRows.length) {
      const projectsResult = await supabaseClient
        .from('portfolio_projects')
        .upsert(projectRows, { onConflict: 'id' });
      if (projectsResult.error) throw projectsResult.error;
    }

    const remote = await loadPortfolio({ includeDrafts: true });
    const remoteGalleryIds = new Set(remote.galleries.map(gallery => gallery.id));
    const remoteProjectIds = new Set(remote.projects.map(project => project.id));
    return {
      importedGalleries: galleryRows.length,
      importedProjects: projectRows.length,
      remoteGalleries: remote.galleries.length,
      remoteProjects: remote.projects.length,
      missingGalleryIds: galleryRows
        .map(row => row.id)
        .filter(id => !remoteGalleryIds.has(id)),
      missingProjectIds: projectRows
        .map(row => row.id)
        .filter(id => !remoteProjectIds.has(id))
    };
  }

  async function deleteGallery(id) {
    const result = await getClient().from('portfolio_sections').delete().eq('id', id);
    if (result.error) throw result.error;
  }

  async function deleteProject(id) {
    const result = await getClient().from('portfolio_projects').delete().eq('id', id);
    if (result.error) throw result.error;
  }

  async function uploadMedia(file, folder) {
    const supabaseClient = getClient();
    if (!supabaseClient) throw new Error('Supabase is not configured.');
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
    const path = `${folder || 'projects'}/${Date.now()}-${safeName}`;
    const bucket = window.SUPABASE_CONFIG.mediaBucket || 'portfolio-media';
    const upload = await supabaseClient.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false
    });
    if (upload.error) throw upload.error;
    return supabaseClient.storage.from(bucket).getPublicUrl(upload.data.path).data.publicUrl;
  }

  async function deploySeoAndPreviews() {
    const supabaseClient = getClient();
    if (!supabaseClient) throw new Error('Supabase is not configured.');

    const result = await supabaseClient.functions.invoke('trigger-site-deploy', {
      body: { source: 'portfolio-admin' }
    });
    if (result.error) {
      let message = result.error.message || 'Could not start the SEO and previews update.';
      const response = result.error.context;
      if (response && typeof response.clone === 'function') {
        try {
          const payload = await response.clone().json();
          if (payload && typeof payload.error === 'string') message = payload.error;
        } catch (_error) {
          // Keep the SDK error when the function did not return JSON.
        }
      }
      throw new Error(message);
    }
    return result.data || { ok: true };
  }

  window.portfolioBackend = {
    hasCredentials,
    isConfigured,
    loadPortfolio,
    loadSiteSettings,
    saveSiteSettings,
    signIn,
    signOut,
    getSession,
    isAdmin,
    importPortfolio,
    deleteGallery,
    deleteProject,
    uploadMedia,
    deploySeoAndPreviews
  };
}());
