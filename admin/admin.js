/**
 * admin/admin.js
 *
 * Portfolio Admin — UI Layer
 * Responsibility: Render and manage the admin panel interface.
 *
 * Dependencies (loaded before this file):
 *   - data/projects-data.js      → PROJECTS_DATA
 *   - admin/admin-storage.js     → adminStorage, SUPPORTED_SIZES
 */

(function () {
  'use strict';

  // ─── State ───────────────────────────────────────────────────

  let managedSection = 'featured-work';

  /** Working copy of the effective project list (all sections) */
  let workingProjects = [];
  let workingGalleries = [];
  let workingSettings = window.siteSettings
    ? siteSettings.loadLocal()
    : {};

  /** Currently selected project id */
  let selectedId = null;

  /** Whether there are unsaved changes to the selected form */
  let formDirty = false;
  let formRevision = 0;
  let saveFeedbackTimer = null;
  let adminStarted = false;
  let remoteEnabled = false;
  let seoDeployPending = false;
  let remoteWriteQueue = Promise.resolve();
  let draggedProjectId = null;
  let suppressProjectClick = false;
  let projectEditingLocale = 'pt-BR';
  let settingsEditingLocale = 'pt-BR';
  let galleryEditingLocale = 'pt-BR';
  const PROJECT_I18N_FIELDS = ['title', 'browserTitle', 'category', 'services', 'projectSummary', 'contribution'];
  const GALLERY_I18N_FIELDS = ['title', 'browserTitle', 'description'];
  const SITE_I18N_FIELDS = window.portfolioI18n?.SITE_FIELDS || [];

  function translationValue(source, locale, field) {
    if (locale !== 'en') return source?.[field] ?? '';
    return source?.translations?.en?.[field] ?? '';
  }

  function translationPlaceholder(source, locale, field) {
    if (locale !== 'en') return '';
    const fallback = Array.isArray(source?.[field]) ? source[field].join(', ') : String(source?.[field] || '');
    return fallback ? `Fallback PT-BR: ${fallback}` : 'Optional — falls back to PT-BR';
  }

  function localeSwitcher(scope, locale) {
    return `<div class="admin-locale-switcher" role="group" aria-label="Editing language">
      <button type="button" data-admin-locale-scope="${scope}" data-admin-locale="pt-BR" class="${locale === 'pt-BR' ? 'active' : ''}">PT-BR</button>
      <button type="button" data-admin-locale-scope="${scope}" data-admin-locale="en" class="${locale === 'en' ? 'active' : ''}">EN</button>
      <span>${locale === 'pt-BR' ? 'Primary language' : 'English translation · empty fields fall back to PT-BR'}</span>
    </div>`;
  }

  function setEnglishTranslation(target, field, value) {
    target.translations = { ...(target.translations || {}) };
    target.translations.en = { ...(target.translations.en || {}), [field]: value };
  }

  function bindLocaleSwitcher(scope, handler) {
    document.querySelectorAll(`[data-admin-locale-scope="${scope}"]`).forEach(button => {
      button.addEventListener('click', () => handler(button.getAttribute('data-admin-locale')));
    });
  }

  function updateLocaleSwitcher(scope, locale) {
    document.querySelectorAll(`[data-admin-locale-scope="${scope}"]`).forEach(button => {
      button.classList.toggle('active', button.getAttribute('data-admin-locale') === locale);
    });
    const note = document.querySelector(`[data-admin-locale-scope="${scope}"]`)?.parentElement?.querySelector('span');
    if (note) note.textContent = locale === 'pt-BR'
      ? 'Primary language'
      : 'English translation · empty fields fall back to PT-BR';
  }

  // ─── DOM References ──────────────────────────────────────────

  const dom = {
    get list()        { return document.getElementById('admin-project-list'); },
    get form()        { return document.getElementById('admin-edit-form'); },
    get formWrap()    { return document.getElementById('admin-form-wrap'); },
    get emptyState()  { return document.getElementById('admin-empty-state'); },
    get status()      { return document.getElementById('admin-status'); },
    get saveBtn()     { return document.getElementById('btn-save'); },
    get exportBtn()   { return document.getElementById('btn-export'); },
    get importBtn()   { return document.getElementById('btn-import'); },
    get importFile()  { return document.getElementById('import-file-input'); },
    get resetBtn()    { return document.getElementById('btn-reset'); },
    get previewBtn()  { return document.getElementById('btn-preview'); },
    get newProjectBtn() { return document.getElementById('btn-new-project'); },
    get newSectionBtn() { return document.getElementById('btn-new-section'); },
    get editSectionBtn() { return document.getElementById('btn-edit-section'); },
    get sectionUpBtn() { return document.getElementById('btn-section-up'); },
    get sectionDownBtn() { return document.getElementById('btn-section-down'); },
    get deleteSectionBtn() { return document.getElementById('btn-delete-section'); },
    get siteSettingsBtn() { return document.getElementById('btn-site-settings'); },
    get sectionSelect() { return document.getElementById('section-select'); },
    get sidebarHeader() { return document.querySelector('.sidebar-header'); },
    get overrideNotice() { return document.getElementById('override-notice'); },
    get authGate()    { return document.getElementById('auth-gate'); },
    get authForm()    { return document.getElementById('auth-form'); },
    get authError()   { return document.getElementById('auth-error'); },
    get authUser()    { return document.getElementById('auth-user'); },
    get logoutBtn()   { return document.getElementById('btn-logout'); },
    get migrateBtn()  { return document.getElementById('btn-migrate-supabase'); },
    get deploySeoBtn() { return document.getElementById('btn-deploy-seo'); },
  };

  // ─── Init ────────────────────────────────────────────────────

  async function init() {
    if (typeof PROJECTS_DATA === 'undefined') {
      showStatus('ERROR: PROJECTS_DATA not loaded. Check script order.', 'error');
      return;
    }
    if (typeof GALLERIES_DATA === 'undefined') {
      showStatus('ERROR: GALLERIES_DATA not loaded. Check script order.', 'error');
      return;
    }

    if (window.portfolioBackend && portfolioBackend.hasCredentials()) {
      bindAuthActions();
      if (!portfolioBackend.isConfigured()) {
        showLogin('Could not load the Supabase client. Check the connection and reload.');
        return;
      }
      try {
        const session = await portfolioBackend.getSession();
        if (!session) {
          showLogin();
          return;
        }
        await authorizeAndStart(session);
      } catch (error) {
        showLogin(error.message || 'Could not validate the current session.');
      }
      return;
    }

    hideLogin();
    await startAdmin();
  }

  async function startAdmin() {
    if (adminStarted) return;
    adminStarted = true;
    let loadedFromSupabase = false;
    if (remoteEnabled) {
      try {
        const remote = await portfolioBackend.loadPortfolio({ includeDrafts: true });
        if (remote) {
          workingProjects = JSON.parse(JSON.stringify(remote.projects));
          workingGalleries = JSON.parse(JSON.stringify(remote.galleries));
          adminStorage.save(workingProjects, []);
          adminStorage.saveGalleries(workingGalleries, []);
          loadedFromSupabase = true;
        }
      } catch (error) {
        console.warn('Could not load Supabase admin data; using local backup.', error);
      }
      try {
        const remoteSettings = await portfolioBackend.loadSiteSettings();
        if (remoteSettings) {
          workingSettings = siteSettings.saveLocal(remoteSettings);
        }
      } catch (error) {
        console.warn('Could not load Supabase site settings; using local settings.', error);
      }
    }
    if (!loadedFromSupabase) loadWorkingData();
    if (!workingGalleries.some(gallery => gallery.id === managedSection)) {
      managedSection = workingGalleries[0] ? workingGalleries[0].id : '';
    }
    renderSectionSelect();
    renderProjectList();
    updateOverrideNotice();
    bindActions();
    return loadedFromSupabase;
  }

  function bindAuthActions() {
    if (dom.authForm) dom.authForm.addEventListener('submit', handleLogin);
    if (dom.logoutBtn) dom.logoutBtn.addEventListener('click', handleLogout);
    if (dom.migrateBtn) dom.migrateBtn.addEventListener('click', migrateToSupabase);
  }

  async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const button = document.getElementById('btn-login');
    if (!email || !password) return showLogin('Enter your email and password.');
    button.disabled = true;
    if (dom.authError) dom.authError.textContent = 'Signing in…';
    try {
      const data = await portfolioBackend.signIn(email, password);
      await authorizeAndStart(data.session);
    } catch (error) {
      showLogin(error.message || 'Sign in failed.');
    } finally {
      button.disabled = false;
    }
  }

  async function authorizeAndStart(session) {
    const authorized = await portfolioBackend.isAdmin();
    if (!authorized) {
      await portfolioBackend.signOut();
      throw new Error('This account is not authorized for the portfolio admin.');
    }
    remoteEnabled = true;
    hideLogin();
    if (dom.authUser) dom.authUser.textContent = session.user.email || 'Authenticated admin';
    if (dom.logoutBtn) dom.logoutBtn.style.display = 'inline-block';
    if (dom.migrateBtn) dom.migrateBtn.style.display = 'inline-block';
    const brandSub = document.querySelector('.brand-sub');
    if (brandSub) brandSub.textContent = 'Connected to Supabase — local backup enabled';
    const loadedFromSupabase = await startAdmin();
    showStatus(
      loadedFromSupabase
        ? 'Connected to Supabase. Admin data is up to date.'
        : 'Supabase is connected, but the local backup was loaded.',
      loadedFromSupabase ? 'success' : 'error'
    );
  }

  async function handleLogout() {
    await portfolioBackend.signOut();
    window.location.reload();
  }

  async function migrateToSupabase() {
    const galleryCount = workingGalleries.length;
    const projectCount = workingProjects.length;
    const confirmed = confirm(
      `Upload the current effective portfolio to Supabase?\n\n` +
      `${galleryCount} section(s)\n${projectCount} project(s)\n\n` +
      'Rows with matching IDs will be updated. This does not delete extra remote rows.'
    );
    if (!confirmed) return;

    dom.migrateBtn.disabled = true;
    showStatus('Uploading portfolio data to Supabase…', 'info');
    try {
      const result = await syncPortfolioSnapshot();
      await portfolioBackend.saveSiteSettings(workingSettings);
      showStatus(
        `Supabase import complete: ${result.importedGalleries} sections, ${result.importedProjects} projects and site settings verified.`,
        'success'
      );
      dom.migrateBtn.textContent = 'Uploaded to Supabase';
    } catch (error) {
      showStatus(`SUPABASE ERROR: ${error.message || error}`, 'error');
    } finally {
      dom.migrateBtn.disabled = false;
    }
  }

  async function deploySeoAndPreviews() {
    if (seoDeployPending) return;
    if (!remoteEnabled) {
      showStatus('Sign in to Supabase before updating SEO and previews.', 'error');
      return;
    }
    if (formDirty) {
      showStatus('Save the current changes first. Content is already live after it is saved to Supabase.', 'error');
      return;
    }

    const button = dom.deploySeoBtn;
    const originalLabel = button ? button.textContent : '';
    seoDeployPending = true;
    if (button) {
      button.disabled = true;
      button.textContent = 'Starting update…';
    }
    showStatus('Starting the SEO and social-preview rebuild…', 'info');

    try {
      await portfolioBackend.deploySeoAndPreviews();
      showStatus('SEO and previews update started. Your saved content was already live.', 'success');
      if (button) button.textContent = 'Update queued';
      window.setTimeout(() => {
        if (button) {
          button.disabled = false;
          button.textContent = originalLabel;
        }
        seoDeployPending = false;
      }, 10000);
    } catch (error) {
      showStatus(`SEO/PREVIEWS ERROR: ${error.message || error}`, 'error');
      if (button) {
        button.disabled = false;
        button.textContent = originalLabel;
      }
      seoDeployPending = false;
    }
  }

  function verifyRemoteImport(result) {
    if (result.missingGalleryIds.length || result.missingProjectIds.length) {
      throw new Error(
        `${result.missingGalleryIds.length} section(s) and ` +
        `${result.missingProjectIds.length} project(s) could not be verified.`
      );
    }
    return result;
  }

  function enqueueRemoteWrite(operation) {
    remoteWriteQueue = remoteWriteQueue
      .catch(() => undefined)
      .then(operation);
    return remoteWriteQueue;
  }

  function syncPortfolioSnapshot() {
    const galleries = JSON.parse(JSON.stringify(workingGalleries));
    const projects = JSON.parse(JSON.stringify(workingProjects));
    return enqueueRemoteWrite(async () => {
      const result = await portfolioBackend.importPortfolio(galleries, projects);
      return verifyRemoteImport(result);
    });
  }

  async function syncAndReport(successMessage, localMessage) {
    if (!remoteEnabled) {
      showStatus(localMessage || successMessage, 'success');
      return true;
    }
    showStatus('Saving to Supabase…', 'info');
    try {
      await syncPortfolioSnapshot();
      showStatus(successMessage, 'success');
      return true;
    } catch (error) {
      showStatus(`Saved locally, but Supabase failed: ${error.message || error}`, 'error');
      return false;
    }
  }

  function deleteRemoteProjectAndSync(id) {
    const galleries = JSON.parse(JSON.stringify(workingGalleries));
    const projects = JSON.parse(JSON.stringify(workingProjects));
    return enqueueRemoteWrite(async () => {
      await portfolioBackend.deleteProject(id);
      return verifyRemoteImport(await portfolioBackend.importPortfolio(galleries, projects));
    });
  }

  function deleteRemoteGalleryAndSync(id) {
    const galleries = JSON.parse(JSON.stringify(workingGalleries));
    const projects = JSON.parse(JSON.stringify(workingProjects));
    return enqueueRemoteWrite(async () => {
      await portfolioBackend.deleteGallery(id);
      return verifyRemoteImport(await portfolioBackend.importPortfolio(galleries, projects));
    });
  }

  function showLogin(message) {
    if (dom.authGate) dom.authGate.hidden = false;
    if (dom.authError) dom.authError.textContent = message || '';
  }

  function hideLogin() {
    if (dom.authGate) dom.authGate.hidden = true;
  }

  function loadWorkingData() {
    const effective = adminStorage.getEffective(PROJECTS_DATA);
    // Deep-clone so we never mutate source data
    workingProjects = JSON.parse(JSON.stringify(effective));
    workingGalleries = adminStorage.getEffectiveGalleries(GALLERIES_DATA);
    if (!workingGalleries.some(gallery => gallery.id === managedSection)) {
      managedSection = workingGalleries[0] ? workingGalleries[0].id : '';
    }
    updateOverrideNotice();
  }

  function updateOverrideNotice() {
    const overrides = adminStorage.load();
    const galleryOverrides = adminStorage.loadGalleries();
    if (dom.overrideNotice) {
      if (overrides || galleryOverrides) {
        const latest = [overrides, galleryOverrides]
          .filter(Boolean)
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
        const date = new Date(latest.updatedAt).toLocaleString();
        dom.overrideNotice.textContent = remoteEnabled
          ? `Supabase connected · local backup updated ${date}`
          : `Local overrides active — last saved ${date}`;
        dom.overrideNotice.className = remoteEnabled
          ? 'override-notice override-source'
          : 'override-notice override-active';
      } else {
        dom.overrideNotice.textContent = 'Showing source data — no local overrides saved yet';
        dom.overrideNotice.className = 'override-notice override-source';
      }
    }
  }

  // ─── Project List ────────────────────────────────────────────

  function renderSectionSelect() {
    if (!dom.sectionSelect) return;
    dom.sectionSelect.innerHTML = '';
    adminStorage.normalizeGalleryOrder(workingGalleries).forEach(gallery => {
      const option = document.createElement('option');
      option.value = gallery.id;
      option.textContent = gallery.title + (gallery.published === false ? ' — Hidden' : '');
      dom.sectionSelect.appendChild(option);
    });
    dom.sectionSelect.value = managedSection;
  }

  function getSectionProjects() {
    return workingProjects
      .filter(p => p.section === managedSection)
      .sort((a, b) => Number(a.order) - Number(b.order));
  }

  function renderProjectList() {
    const listEl = dom.list;
    if (!listEl) return;

    const projects = getSectionProjects();
    listEl.innerHTML = '';
    const sectionLabel = getSectionLabel(managedSection);
    listEl.setAttribute('aria-label', `${sectionLabel} project list`);
    if (dom.sidebarHeader) {
      dom.sidebarHeader.textContent = `${sectionLabel} — click to edit · drag to reorder`;
    }

    if (projects.length === 0) {
      listEl.innerHTML = '<li class="list-empty">No projects found in this section.</li>';
      return;
    }

    projects.forEach((project, idx) => {
      const li = document.createElement('li');
      li.className = 'project-list-item' + (project.id === selectedId ? ' selected' : '');
      li.setAttribute('data-id', project.id);

      const hasCover = Boolean(project.coverImage);
      const hasPreview = Boolean(project.previewVideo);

      li.innerHTML = `
        <div class="list-item-thumb">
          ${hasCover
            ? `<img src="${escAdm(project.coverImage)}" alt="${escAdm(project.title)}" />`
            : hasPreview
              ? `<video src="${escAdm(project.previewVideo)}" muted playsinline preload="metadata"></video>`
              : '<span class="list-thumb-empty">No media</span>'
          }
        </div>
        <div class="list-item-info">
          <div class="list-item-title">${escAdm(project.title)}</div>
          <div class="list-item-meta">
            <span class="tag">${escAdm(project.size)}</span>
            <span class="tag ${project.published ? 'tag-pub' : 'tag-unpub'}">${project.published ? 'Published' : 'Hidden'}</span>
            <span class="tag">Order: ${project.order}</span>
          </div>
          <div class="list-item-client">${escAdm(project.client || '')} — ${escAdm(project.category || '')}</div>
        </div>
        <span
          class="project-drag-handle"
          draggable="true"
          role="button"
          tabindex="0"
          aria-label="Drag ${escAdm(project.title)} to reorder. Use the arrow keys while focused."
          title="Drag to reorder"
        >⠿</span>
      `;

      li.addEventListener('click', (e) => {
        if (e.target.closest('.project-drag-handle') || suppressProjectClick) return;
        selectProject(project.id);
      });

      bindProjectDragItem(li, project, idx, projects);

      listEl.appendChild(li);
    });
  }

  function clearProjectDragState() {
    draggedProjectId = null;
    document.querySelectorAll('.project-list-item').forEach(item => {
      item.classList.remove('is-dragging', 'drag-before', 'drag-after');
    });
    window.setTimeout(() => { suppressProjectClick = false; }, 0);
  }

  function bindProjectDragItem(item, project, index, projects) {
    const handle = item.querySelector('.project-drag-handle');
    if (!handle) return;

    handle.addEventListener('click', event => event.stopPropagation());
    handle.addEventListener('keydown', event => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      event.stopPropagation();
      const offset = event.key === 'ArrowUp' ? -1 : 1;
      reorderProject(project.id, index + offset);
    });

    handle.addEventListener('dragstart', event => {
      draggedProjectId = project.id;
      suppressProjectClick = true;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', project.id);
      window.requestAnimationFrame(() => item.classList.add('is-dragging'));
    });

    handle.addEventListener('dragend', clearProjectDragState);

    item.addEventListener('dragover', event => {
      if (!draggedProjectId || draggedProjectId === project.id) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('.project-list-item').forEach(other => {
        if (other !== item) other.classList.remove('drag-before', 'drag-after');
      });
      const position = event.clientY < item.getBoundingClientRect().top + item.offsetHeight / 2
        ? 'drag-before'
        : 'drag-after';
      item.classList.toggle('drag-before', position === 'drag-before');
      item.classList.toggle('drag-after', position === 'drag-after');

      if (event.clientY < 80) window.scrollBy(0, -12);
      if (event.clientY > window.innerHeight - 80) window.scrollBy(0, 12);
    });

    item.addEventListener('drop', event => {
      event.preventDefault();
      const sourceId = draggedProjectId || event.dataTransfer.getData('text/plain');
      const sourceProject = projects.find(candidate => candidate.id === sourceId);
      if (!sourceProject || sourceProject.id === project.id) {
        clearProjectDragState();
        return;
      }

      const remaining = projects.filter(candidate => candidate.id !== sourceProject.id);
      const targetIndex = remaining.findIndex(candidate => candidate.id === project.id);
      const insertAfter = event.clientY >= item.getBoundingClientRect().top + item.offsetHeight / 2;
      const requestedIndex = targetIndex + (insertAfter ? 1 : 0);
      clearProjectDragState();
      reorderProject(sourceProject.id, requestedIndex);
    });
  }

  // ─── Select & Form ───────────────────────────────────────────

  function selectProject(id) {
    if (formDirty && selectedId !== id) {
      if (!confirm('You have unsaved changes. Discard them?')) return;
    }

    selectedId = id;
    formDirty = false;
    const project = workingProjects.find(p => p.id === id);
    if (!project) return;

    renderProjectList();
    renderEditForm(project);
  }

  function renderProjectStillSlots(project) {
    const stills = normalizeProjectStills(project.projectStills);
    return Array.from({ length: 3 }, (_, index) => {
      const still = stills[index] || { url: '', size: '16-9' };
      const slot = index + 1;
      return `
        <div class="project-still-slot">
          <label for="field-projectStillUrl-${index}">Image ${slot}</label>
          <div class="project-still-preview" id="project-still-preview-${index}" aria-live="polite">
            ${still.url
              ? `<img src="${escAdm(still.url)}" alt="Preview of image ${slot}" loading="lazy" decoding="async" fetchpriority="low" />`
              : '<span class="project-still-preview-empty">No image selected</span>'
            }
          </div>
          <input id="field-projectStillUrl-${index}" type="text" value="${escAdm(still.url)}" data-still-url="${index}" placeholder="Image path / URL" />
          <div class="project-still-actions">
            <select id="field-projectStillSize-${index}" data-still-size="${index}" aria-label="Image ${slot} aspect ratio">
              ${SUPPORTED_SIZES.map(size =>
                `<option value="${size}" ${still.size === size ? 'selected' : ''}>${size} ${size === '16-9' ? '— Widescreen' : size === '9-16' ? '— Portrait' : '— Classic 4:3'}</option>`
              ).join('')}
            </select>
            <button id="btn-clear-projectStill-${index}" class="btn btn-danger" type="button">Clear</button>
          </div>
          <button id="btn-upload-projectStill-${index}" class="btn btn-secondary" type="button">Upload Image ${slot}</button>
          <input id="file-projectStill-${index}" class="media-file-input" type="file" accept="image/*" />
        </div>`;
    }).join('');
  }

  function markProjectFormDirty() {
    markFormDirty();
  }

  function getActiveSaveButton() {
    return dom.form
      ? dom.form.querySelector('#btn-save, #btn-save-gallery, #btn-save-site-settings')
      : null;
  }

  function updateInlineSaveStatus(message, state) {
    const hint = document.getElementById('dirty-hint');
    if (!hint) return;
    clearTimeout(saveFeedbackTimer);
    hint.textContent = message;
    hint.className = 'form-dirty-hint' + (state ? ` is-${state}` : '');
    hint.style.display = 'inline';
  }

  function markFormDirty() {
    formDirty = true;
    formRevision += 1;
    updateInlineSaveStatus('Unsaved changes', 'dirty');
  }

  function beginFormSave(button) {
    if (!button) return;
    button.dataset.defaultLabel = button.dataset.defaultLabel || button.textContent;
    button.disabled = true;
    button.textContent = 'Saving…';
    updateInlineSaveStatus(remoteEnabled ? 'Saving to Supabase…' : 'Saving locally…', 'saving');
  }

  function finishFormSave(button, savedRevision, remoteSynced, successMessage) {
    const sameForm = Boolean(button && document.body.contains(button));
    if (sameForm) {
      button.disabled = false;
      button.textContent = button.dataset.defaultLabel || 'Save Changes';
    }
    if (savedRevision !== formRevision) {
      if (!sameForm) return;
      formDirty = true;
      updateInlineSaveStatus('Newer changes are still unsaved', 'dirty');
      return;
    }
    formDirty = false;
    updateInlineSaveStatus(
      remoteSynced ? successMessage : 'Saved locally · Supabase sync failed',
      remoteSynced ? 'saved' : 'error'
    );
    if (remoteSynced) {
      saveFeedbackTimer = setTimeout(() => {
        const hint = document.getElementById('dirty-hint');
        if (hint && !formDirty) hint.style.display = 'none';
      }, 3500);
    }
  }

  function normalizeCoverFocus(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 50;
  }

  function normalizeCoverScale(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(100, Math.min(200, number)) : 100;
  }

  function bindCoverFocusControls(mode) {
    const fieldPrefix = ['desktop', 'hero'].includes(mode) ? mode : 'mobile';
    const preview = document.getElementById(`${fieldPrefix}-focus-preview`);
    const mediaHost = document.getElementById(`${fieldPrefix}-focus-media`);
    const marker = document.getElementById(`${fieldPrefix}-focus-marker`);
    const xInput = document.getElementById(`field-${fieldPrefix}FocusX`);
    const yInput = document.getElementById(`field-${fieldPrefix}FocusY`);
    const scaleInput = document.getElementById(`field-${fieldPrefix}CoverScale`);
    const xOutput = document.getElementById(`${fieldPrefix}-focus-x-value`);
    const yOutput = document.getElementById(`${fieldPrefix}-focus-y-value`);
    const scaleOutput = document.getElementById(`${fieldPrefix}-cover-scale-value`);
    const resetButton = document.getElementById(`btn-reset-${fieldPrefix}-focus`);
    const coverInput = document.getElementById('field-coverImage');
    const videoInput = document.getElementById('field-previewVideo');
    const sizeInput = document.getElementById('field-size');
    if (!preview || !mediaHost || !marker || !xInput || !yInput || !scaleInput) return;

    const updatePosition = () => {
      const x = normalizeCoverFocus(xInput.value);
      const y = normalizeCoverFocus(yInput.value);
      const scale = normalizeCoverScale(scaleInput.value);
      const media = mediaHost.querySelector('img, video');
      if (media) {
        media.style.objectPosition = `${x}% ${y}%`;
        media.style.transform = `scale(${scale / 100})`;
        media.style.transformOrigin = `${x}% ${y}%`;
      }
      marker.style.left = `${x}%`;
      marker.style.top = `${y}%`;
      if (xOutput) xOutput.value = `${Math.round(x)}%`;
      if (yOutput) yOutput.value = `${Math.round(y)}%`;
      if (scaleOutput) scaleOutput.value = `${Math.round(scale)}%`;
    };

    const renderMedia = () => {
      const coverUrl = coverInput ? coverInput.value.trim() : '';
      const videoUrl = videoInput ? videoInput.value.trim() : '';
      if (coverUrl) {
        const image = document.createElement('img');
        image.src = coverUrl;
        image.alt = '';
        mediaHost.replaceChildren(image);
      } else if (videoUrl) {
        const video = document.createElement('video');
        video.src = videoUrl;
        video.muted = true;
        video.playsInline = true;
        video.preload = 'metadata';
        mediaHost.replaceChildren(video);
      } else {
        const empty = document.createElement('span');
        empty.className = 'cover-focus-empty';
        empty.textContent = 'Add cover media to preview';
        mediaHost.replaceChildren(empty);
      }
      updatePosition();
    };

    const updatePreviewRatio = () => {
      if (fieldPrefix !== 'desktop' || !sizeInput) return;
      preview.classList.remove('ratio-16-9', 'ratio-4-3', 'ratio-9-16');
      preview.classList.add(`ratio-${SUPPORTED_SIZES.includes(sizeInput.value) ? sizeInput.value : '16-9'}`);
    };

    const setFromPointer = event => {
      const rect = preview.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
      xInput.value = String(Math.round(x));
      yInput.value = String(Math.round(y));
      updatePosition();
      markProjectFormDirty();
    };

    xInput.addEventListener('input', updatePosition);
    yInput.addEventListener('input', updatePosition);
    scaleInput.addEventListener('input', updatePosition);
    if (resetButton) {
      resetButton.addEventListener('click', () => {
        xInput.value = '50';
        yInput.value = '50';
        scaleInput.value = '100';
        updatePosition();
        markProjectFormDirty();
      });
    }
    if (coverInput) coverInput.addEventListener('input', renderMedia);
    if (videoInput) videoInput.addEventListener('input', renderMedia);
    if (sizeInput && fieldPrefix === 'desktop') sizeInput.addEventListener('change', updatePreviewRatio);
    preview.addEventListener('pointerdown', event => {
      preview.setPointerCapture(event.pointerId);
      setFromPointer(event);
    });
    preview.addEventListener('pointermove', event => {
      if (preview.hasPointerCapture(event.pointerId)) setFromPointer(event);
    });
    updatePreviewRatio();
    renderMedia();
  }

  function renderEditForm(project) {
    const wrap = dom.formWrap;
    const empty = dom.emptyState;
    if (!wrap || !empty) return;

    wrap.style.display = 'block';
    empty.style.display = 'none';

    const form = dom.form;
    if (!form) return;
    formRevision += 1;

    const desktopFocusX = normalizeCoverFocus(project.desktopFocusX);
    const desktopFocusY = normalizeCoverFocus(project.desktopFocusY);
    const desktopCoverScale = normalizeCoverScale(project.desktopCoverScale);
    const heroFocusX = normalizeCoverFocus(project.heroFocusX);
    const heroFocusY = normalizeCoverFocus(project.heroFocusY);
    const heroCoverScale = normalizeCoverScale(project.heroCoverScale);
    const mobileFocusX = normalizeCoverFocus(project.mobileFocusX);
    const mobileFocusY = normalizeCoverFocus(project.mobileFocusY);
    const mobileCoverScale = normalizeCoverScale(project.mobileCoverScale);
    const projectText = field => translationValue(project, projectEditingLocale, field);
    const projectPlaceholder = field => translationPlaceholder(project, projectEditingLocale, field);

    form.innerHTML = `
      <div class="form-header">
        <h2 class="form-title" id="form-heading">Editing: <span>${escAdm(project.title)}</span></h2>
        ${localeSwitcher('project', projectEditingLocale)}
      </div>

      <div class="form-grid">
        <section class="form-card" aria-labelledby="project-info-heading">
          <div class="form-card-header">
            <h3 class="form-card-title" id="project-info-heading">Project Information</h3>
            <p class="form-card-description">Credits and written content shown on the project page.</p>
          </div>
          <div class="form-card-grid">
        <div class="form-group">
          <label for="field-title">Title</label>
          <input id="field-title" type="text" value="${escAdm(projectText('title'))}" data-field="title" data-project-i18n-field="title" placeholder="${escAdm(projectPlaceholder('title'))}" />
        </div>

        <div class="form-group">
          <label for="field-browserTitle">Browser Tab Title — Optional</label>
          <input id="field-browserTitle" type="text" maxlength="120" value="${escAdm(projectText('browserTitle'))}" data-field="browserTitle" data-project-i18n-field="browserTitle" placeholder="${escAdm(projectPlaceholder('browserTitle') || `ARTUR ARAUJO | ${project.title}`)}" />
          <span class="media-upload-note">Controls the browser tab and shared-link title. Leave empty to use “ARTUR ARAUJO | Project Title”.</span>
        </div>

        <div class="form-group">
          <label for="field-client">Client</label>
          <input id="field-client" type="text" value="${escAdm(project.client || '')}" data-field="client" />
        </div>

        <div class="form-group">
          <label for="field-category">Category</label>
          <input id="field-category" type="text" value="${escAdm(projectText('category'))}" data-field="category" data-project-i18n-field="category" placeholder="${escAdm(projectPlaceholder('category'))}" />
        </div>

        <div class="form-group">
          <label for="field-year">Year</label>
          <input id="field-year" type="text" value="${escAdm(project.year || '')}" data-field="year" />
        </div>

        <div class="form-group span-2">
          <label for="field-services">Areas of Work</label>
          <input id="field-services" type="text" value="${escAdm(Array.isArray(projectText('services')) ? projectText('services').join(', ') : '')}" data-field="services" data-project-i18n-field="services" placeholder="${escAdm(projectPlaceholder('services') || 'Editing, VFX Compositing, Motion Design')}" />
          <span class="media-upload-note">Separate each area with a comma. These appear as tags on the project page.</span>
        </div>

        <div class="form-group span-2">
          <label for="field-projectSummary">Project Context</label>
          <textarea id="field-projectSummary" rows="3" data-field="projectSummary" data-project-i18n-field="projectSummary" placeholder="${escAdm(projectPlaceholder('projectSummary') || 'A short description of the series, film or campaign.')}">${escAdm(projectText('projectSummary'))}</textarea>
        </div>

        <div class="form-group span-2">
          <label for="field-contribution">My Contribution</label>
          <textarea id="field-contribution" rows="4" data-field="contribution" data-project-i18n-field="contribution" placeholder="${escAdm(projectPlaceholder('contribution') || 'Describe exactly what you handled on this project.')}">${escAdm(projectText('contribution'))}</textarea>
        </div>

        <div class="form-group">
          <label for="field-director">Director</label>
          <input id="field-director" type="text" value="${escAdm(project.director || '')}" data-field="director" />
        </div>

        <div class="form-group">
          <label for="field-productionCompany">Production Company</label>
          <input id="field-productionCompany" type="text" value="${escAdm(project.productionCompany || '')}" data-field="productionCompany" />
        </div>

          </div>
        </section>

        <section class="form-card" aria-labelledby="gallery-appearance-heading">
          <div class="form-card-header">
            <h3 class="form-card-title" id="gallery-appearance-heading">Gallery Appearance</h3>
            <p class="form-card-description">Placement, visibility and media used in the project selection pages.</p>
          </div>
          <div class="form-card-grid">

        <div class="form-group">
          <label for="field-slug">Slug</label>
          <input id="field-slug" type="text" value="${escAdm(project.slug || '')}" data-field="slug" />
        </div>

        <div class="form-group">
          <label for="field-order">Display Order</label>
          <input id="field-order" type="number" min="1" value="${project.order}" data-field="order" />
        </div>

        <div class="form-group">
          <label for="field-section">Section</label>
          <select id="field-section" data-field="section">
            ${workingGalleries.map(gallery =>
              `<option value="${escAdm(gallery.id)}" ${project.section === gallery.id ? 'selected' : ''}>${escAdm(gallery.title)}</option>`
            ).join('')}
          </select>
        </div>

        <div class="form-group">
          <label for="field-published">Visibility</label>
          <select id="field-published" data-field="published">
            <option value="true" ${project.published ? 'selected' : ''}>Published — visible in gallery</option>
            <option value="false" ${!project.published ? 'selected' : ''}>Hidden — excluded from gallery</option>
          </select>
        </div>

        <div class="form-group">
          <label for="field-size">Aspect Ratio / Size</label>
          <select id="field-size" data-field="size">
            ${SUPPORTED_SIZES.map(s =>
              `<option value="${s}" ${project.size === s ? 'selected' : ''}>${s} ${s === '16-9' ? '— Widescreen' : s === '9-16' ? '— Portrait' : '— Classic 4:3'}</option>`
            ).join('')}
          </select>
        </div>

        <div class="form-group">
          <span class="form-subsection-heading">Ordering</span>
          <span class="media-upload-note">Drag projects in the sidebar for faster ordering. Display Order remains available for precise placement.</span>
        </div>

        <div class="gallery-media-workspace">
          <div class="gallery-media-fields">
            <div class="form-group">
              <label for="field-coverImage">Cover Image Path / URL</label>
              <div class="media-input-row">
                <input id="field-coverImage" type="text" value="${escAdm(project.coverImage || '')}" data-field="coverImage" />
                <button id="btn-upload-coverImage" class="btn btn-secondary" type="button">Upload Cover</button>
              </div>
              <input id="file-coverImage" class="media-file-input" type="file" accept="image/*" />
              <span class="media-upload-note">The still image shown before the visitor hovers over the project.</span>
            </div>

            <div class="form-group">
              <label for="field-previewVideo">Hover Video Path / URL</label>
              <div class="media-input-row">
                <input id="field-previewVideo" type="text" value="${escAdm(project.previewVideo || '')}" data-field="previewVideo" />
                <button id="btn-upload-previewVideo" class="btn btn-secondary" type="button">Upload Hover Video</button>
              </div>
              <input id="file-previewVideo" class="media-file-input" type="file" accept="video/mp4,video/webm" />
              <span class="media-upload-note">Optional. Plays only while the visitor hovers; without a cover, its first frame is used.</span>
            </div>
          </div>

          <div class="cover-focus-panels">
            <div class="cover-focus-panel desktop-cover-focus">
              <div class="cover-focus-header">
                <span class="form-subsection-heading">Desktop Thumbnail Framing</span>
                <button id="btn-reset-desktop-focus" class="btn btn-secondary cover-focus-reset" type="button">Reset</button>
              </div>
              <div class="cover-focus-editor">
                <div id="desktop-focus-preview" class="cover-focus-preview desktop-cover-preview ratio-${SUPPORTED_SIZES.includes(project.size) ? project.size : '16-9'}" aria-label="Drag to choose the desktop cover focal point">
                  <div id="desktop-focus-media" class="cover-focus-media"></div>
                  <span id="desktop-focus-marker" class="cover-focus-marker" aria-hidden="true"></span>
                </div>
                <div class="cover-focus-controls">
                  <label for="field-desktopFocusX">Horizontal <output id="desktop-focus-x-value">${Math.round(desktopFocusX)}%</output></label>
                  <input id="field-desktopFocusX" type="range" min="0" max="100" step="1" value="${desktopFocusX}" data-field="desktopFocusX" />
                  <label for="field-desktopFocusY">Vertical <output id="desktop-focus-y-value">${Math.round(desktopFocusY)}%</output></label>
                  <input id="field-desktopFocusY" type="range" min="0" max="100" step="1" value="${desktopFocusY}" data-field="desktopFocusY" />
                  <label for="field-desktopCoverScale">Scale <output id="desktop-cover-scale-value">${Math.round(desktopCoverScale)}%</output></label>
                  <input id="field-desktopCoverScale" type="range" min="100" max="200" step="1" value="${desktopCoverScale}" data-field="desktopCoverScale" />
                  <span class="media-upload-note">Preview follows the selected aspect ratio. Applied to gallery thumbnails and the desktop project page.</span>
                </div>
              </div>
            </div>

            <div class="cover-focus-panel hero-cover-focus">
              <div class="cover-focus-header">
                <span class="form-subsection-heading">Featured Hero Framing</span>
                <button id="btn-reset-hero-focus" class="btn btn-secondary cover-focus-reset" type="button">Reset</button>
              </div>
              <div class="cover-focus-editor">
                <div id="hero-focus-preview" class="cover-focus-preview hero-cover-preview" aria-label="Drag to choose the Featured Hero focal point">
                  <div id="hero-focus-media" class="cover-focus-media"></div>
                  <span id="hero-focus-marker" class="cover-focus-marker" aria-hidden="true"></span>
                </div>
                <div class="cover-focus-controls">
                  <label for="field-heroFocusX">Horizontal <output id="hero-focus-x-value">${Math.round(heroFocusX)}%</output></label>
                  <input id="field-heroFocusX" type="range" min="0" max="100" step="1" value="${heroFocusX}" data-field="heroFocusX" />
                  <label for="field-heroFocusY">Vertical <output id="hero-focus-y-value">${Math.round(heroFocusY)}%</output></label>
                  <input id="field-heroFocusY" type="range" min="0" max="100" step="1" value="${heroFocusY}" data-field="heroFocusY" />
                  <label for="field-heroCoverScale">Scale <output id="hero-cover-scale-value">${Math.round(heroCoverScale)}%</output></label>
                  <input id="field-heroCoverScale" type="range" min="100" max="200" step="1" value="${heroCoverScale}" data-field="heroCoverScale" />
                  <span class="media-upload-note">Always previews the horizontal Featured Hero crop and does not change the gallery thumbnail.</span>
                </div>
              </div>
            </div>

            <div class="cover-focus-panel mobile-cover-focus">
              <div class="cover-focus-header">
                <span class="form-subsection-heading">Mobile Cover Framing</span>
                <button id="btn-reset-mobile-focus" class="btn btn-secondary cover-focus-reset" type="button">Reset</button>
              </div>
              <div class="cover-focus-editor">
                <div id="mobile-focus-preview" class="cover-focus-preview mobile-cover-preview" aria-label="Drag to choose the mobile cover focal point">
                  <div id="mobile-focus-media" class="cover-focus-media"></div>
                  <span id="mobile-focus-marker" class="cover-focus-marker" aria-hidden="true"></span>
                </div>
                <div class="cover-focus-controls">
                <label for="field-mobileFocusX">Horizontal <output id="mobile-focus-x-value">${Math.round(mobileFocusX)}%</output></label>
                <input id="field-mobileFocusX" type="range" min="0" max="100" step="1" value="${mobileFocusX}" data-field="mobileFocusX" />
                <label for="field-mobileFocusY">Vertical <output id="mobile-focus-y-value">${Math.round(mobileFocusY)}%</output></label>
                <input id="field-mobileFocusY" type="range" min="0" max="100" step="1" value="${mobileFocusY}" data-field="mobileFocusY" />
                <label for="field-mobileCoverScale">Scale <output id="mobile-cover-scale-value">${Math.round(mobileCoverScale)}%</output></label>
                <input id="field-mobileCoverScale" type="range" min="100" max="200" step="1" value="${mobileCoverScale}" data-field="mobileCoverScale" />
                  <span class="media-upload-note">Applied to gallery thumbnails, the mobile opening highlight and the mobile project page.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

          </div>
        </section>

        <section class="form-card" aria-labelledby="project-page-heading">
          <div class="form-card-header">
            <h3 class="form-card-title" id="project-page-heading">Project Page Media &amp; Links</h3>
            <p class="form-card-description">Player, additional stills and optional external viewing link.</p>
          </div>
          <div class="form-card-grid">

        <div class="form-group span-2">
          <label for="field-youtubeUrl">YouTube Video URL</label>
          <input id="field-youtubeUrl" type="text" value="${escAdm(project.youtubeUrl || '')}" data-field="youtubeUrl" placeholder="https://www.youtube.com/watch?v=..." />
          <span class="media-upload-note">Optional full video for the individual project page. Public, unlisted, Shorts and youtu.be links are accepted.</span>
        </div>

        <h4 class="form-subsection-heading span-2">Project Page Stills</h4>
        <div class="project-stills-editor">
          ${renderProjectStillSlots(project)}
        </div>
        <div class="form-group span-2">
          <span class="media-upload-note">Up to three images. Each slot keeps its own gallery-style aspect ratio and appears on the individual project page.</span>
        </div>

        <div class="form-group">
          <label for="field-watchNowEnabled">Watch Now</label>
          <select id="field-watchNowEnabled" data-field="watchNowEnabled">
            <option value="false" ${!project.watchNowEnabled ? 'selected' : ''}>Disabled — hidden from project page</option>
            <option value="true" ${project.watchNowEnabled ? 'selected' : ''}>Enabled — show external link</option>
          </select>
        </div>

        <div class="form-group">
          <label for="field-watchNowUrl">Watch Now External URL</label>
          <input id="field-watchNowUrl" type="text" value="${escAdm(project.watchNowUrl || '')}" data-field="watchNowUrl" placeholder="https://streaming-service.com/project" ${project.watchNowEnabled ? '' : 'disabled'} />
          <span class="media-upload-note">The URL is preserved when Watch Now is disabled.</span>
        </div>
          </div>
        </section>
      </div>

      <div class="form-actions">
        <button id="btn-save" class="btn btn-primary" type="button" data-id="${escAdm(project.id)}">Save Changes</button>
        <button id="btn-preview" class="btn btn-secondary" type="button">Preview in Gallery</button>
        <span class="form-dirty-hint" id="dirty-hint" style="display:none" role="status"></span>
        <span class="form-action-spacer"></span>
        <button id="btn-duplicate" class="btn btn-secondary" type="button">Duplicate</button>
        <button id="btn-delete" class="btn btn-danger" type="button">Delete Project</button>
      </div>
    `;

    // Mark form dirty on any change
    form.querySelectorAll('[data-field]').forEach(el => {
      el.addEventListener('input', markProjectFormDirty);
    });
    form.querySelectorAll('[data-still-url], [data-still-size]').forEach(el => {
      el.addEventListener('input', markProjectFormDirty);
    });

    const watchNowEnabled = document.getElementById('field-watchNowEnabled');
    const watchNowUrl = document.getElementById('field-watchNowUrl');
    if (watchNowEnabled && watchNowUrl) {
      watchNowEnabled.addEventListener('change', () => {
        watchNowUrl.disabled = watchNowEnabled.value !== 'true';
        if (!watchNowUrl.disabled) watchNowUrl.focus();
      });
    }

    // Re-bind save and preview
    const saveBtn = document.getElementById('btn-save');
    if (saveBtn) saveBtn.addEventListener('click', () => saveProject(project.id));

    const previewBtn = document.getElementById('btn-preview');
    if (previewBtn) previewBtn.addEventListener('click', previewGallery);

    const duplicateBtn = document.getElementById('btn-duplicate');
    if (duplicateBtn) duplicateBtn.addEventListener('click', () => duplicateProject(project.id));

    const deleteBtn = document.getElementById('btn-delete');
    if (deleteBtn) deleteBtn.addEventListener('click', () => deleteProject(project.id));

    bindMediaUpload(project.id, 'coverImage');
    bindMediaUpload(project.id, 'previewVideo');
    bindLocaleSwitcher('project', locale => {
      if (locale === projectEditingLocale) return;
      const currentIndex = workingProjects.findIndex(item => item.id === project.id);
      if (currentIndex === -1) return;
      const current = { ...workingProjects[currentIndex] };
      let changed = false;
      dom.form.querySelectorAll('[data-project-i18n-field]').forEach(input => {
        const field = input.getAttribute('data-project-i18n-field');
        const value = field === 'services'
          ? [...new Set(input.value.split(',').map(item => item.trim()).filter(Boolean))]
          : input.value.trim();
        const previous = translationValue(current, projectEditingLocale, field);
        if (JSON.stringify(previous) !== JSON.stringify(value)) changed = true;
        if (projectEditingLocale === 'en') setEnglishTranslation(current, field, value);
        else current[field] = value;
      });
      workingProjects[currentIndex] = current;
      projectEditingLocale = locale;
      if (changed) markProjectFormDirty();
      dom.form.querySelectorAll('[data-project-i18n-field]').forEach(input => {
        const field = input.getAttribute('data-project-i18n-field');
        const value = translationValue(current, locale, field);
        input.value = Array.isArray(value) ? value.join(', ') : value;
        input.placeholder = translationPlaceholder(current, locale, field) || input.placeholder;
      });
      updateLocaleSwitcher('project', locale);
    });
    bindCoverFocusControls('desktop');
    bindCoverFocusControls('hero');
    bindCoverFocusControls('mobile');
    [0, 1, 2].forEach(index => bindProjectStillControls(project.id, index));
  }

  // ─── Create, Duplicate & Delete ─────────────────────────────

  function bindMediaUpload(projectId, field) {
    const button = document.getElementById(`btn-upload-${field}`);
    const fileInput = document.getElementById(`file-${field}`);
    if (!button || !fileInput) return;

    button.addEventListener('click', () => {
      if (!remoteEnabled) {
        showStatus('ERROR: Sign in to Supabase before uploading media.', 'error');
        return;
      }
      fileInput.click();
    });

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      await uploadProjectMedia(projectId, field, file, button);
      fileInput.value = '';
    });
  }

  function bindProjectStillControls(projectId, index) {
    const uploadButton = document.getElementById(`btn-upload-projectStill-${index}`);
    const clearButton = document.getElementById(`btn-clear-projectStill-${index}`);
    const fileInput = document.getElementById(`file-projectStill-${index}`);
    const urlInput = document.getElementById(`field-projectStillUrl-${index}`);
    const sizeInput = document.getElementById(`field-projectStillSize-${index}`);
    const preview = document.getElementById(`project-still-preview-${index}`);
    if (!uploadButton || !clearButton || !fileInput || !urlInput || !sizeInput || !preview) return;

    let previewTimer = null;
    const showPreviewMessage = message => {
      const empty = document.createElement('span');
      empty.className = 'project-still-preview-empty';
      empty.textContent = message;
      preview.replaceChildren(empty);
    };
    const updatePreview = () => {
      clearTimeout(previewTimer);
      const url = urlInput.value.trim();
      if (!url) {
        showPreviewMessage('No image selected');
        return;
      }
      const image = document.createElement('img');
      image.src = url;
      image.alt = `Preview of image ${index + 1}`;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.fetchPriority = 'low';
      image.addEventListener('error', () => showPreviewMessage('Preview unavailable'));
      preview.replaceChildren(image);
    };
    const schedulePreview = () => {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(updatePreview, 300);
    };
    urlInput.addEventListener('input', schedulePreview);
    updatePreview();

    uploadButton.addEventListener('click', () => {
      if (!remoteEnabled) {
        showStatus('ERROR: Sign in to Supabase before uploading media.', 'error');
        return;
      }
      fileInput.click();
    });

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        showStatus('ERROR: Project stills must be image files.', 'error');
        fileInput.value = '';
        return;
      }
      const originalLabel = uploadButton.textContent;
      uploadButton.disabled = true;
      uploadButton.textContent = 'Uploading…';
      showStatus(`Uploading ${file.name} to Supabase Storage…`, 'info');
      try {
        const safeProjectId = String(projectId || 'project').replace(/[^a-zA-Z0-9_-]+/g, '-');
        urlInput.value = await portfolioBackend.uploadMedia(
          file,
          `projects/${safeProjectId}/stills/slot-${index + 1}`
        );
        urlInput.dispatchEvent(new Event('input', { bubbles: true }));
        showStatus('Upload complete. Click Save Changes to publish the project still.', 'success');
      } catch (error) {
        showStatus(`UPLOAD ERROR: ${error.message || error}`, 'error');
      } finally {
        uploadButton.disabled = false;
        uploadButton.textContent = originalLabel;
        fileInput.value = '';
      }
    });

    clearButton.addEventListener('click', () => {
      urlInput.value = '';
      sizeInput.value = '16-9';
      urlInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  async function uploadProjectMedia(projectId, field, file, button) {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type === 'video/mp4' || file.type === 'video/webm';
    if (field === 'coverImage' && !isImage) {
      showStatus('ERROR: The cover must be an image file.', 'error');
      return;
    }
    if (field === 'previewVideo' && !isVideo) {
      showStatus('ERROR: The hover preview must be an MP4 or WebM video.', 'error');
      return;
    }

    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = 'Uploading…';
    showStatus(`Uploading ${file.name} to Supabase Storage…`, 'info');
    try {
      const safeProjectId = String(projectId || 'project').replace(/[^a-zA-Z0-9_-]+/g, '-');
      const publicUrl = await portfolioBackend.uploadMedia(
        file,
        `projects/${safeProjectId}/${field === 'coverImage' ? 'cover' : 'preview-video'}`
      );
      const fieldInput = document.getElementById(`field-${field}`);
      if (!fieldInput) throw new Error('The media URL field is no longer available.');
      fieldInput.value = publicUrl;
      fieldInput.dispatchEvent(new Event('input', { bubbles: true }));
      showStatus('Upload complete. Click Save Changes to publish the new media URL.', 'success');
    } catch (error) {
      showStatus(`UPLOAD ERROR: ${error.message || error}`, 'error');
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }

  async function createProject() {
    if (formDirty && !confirm('You have unsaved changes. Discard them?')) return;

    const slug = uniqueSlug('untitled-project');
    const project = {
      id: slug,
      slug: slug,
      title: 'UNTITLED PROJECT',
      browserTitle: '',
      client: '',
      category: '',
      year: String(new Date().getFullYear()),
      coverImage: '',
      desktopFocusX: 50,
      desktopFocusY: 50,
      desktopCoverScale: 100,
      heroFocusX: 50,
      heroFocusY: 50,
      heroCoverScale: 100,
      mobileFocusX: 50,
      mobileFocusY: 50,
      mobileCoverScale: 100,
      translations: { en: {} },
      previewVideo: '',
      youtubeUrl: '',
      projectStills: [],
      services: [],
      projectSummary: '',
      contribution: '',
      director: '',
      productionCompany: '',
      watchNowEnabled: false,
      watchNowUrl: '',
      section: managedSection,
      size: '16-9',
      published: false,
      order: getSectionProjects().length + 1
    };

    workingProjects.push(project);
    adminStorage.save(workingProjects);
    selectedId = project.id;
    formDirty = false;
    updateOverrideNotice();
    renderProjectList();
    renderEditForm(project);
    await syncAndReport(
      'New draft project created in Supabase. Complete the fields and save.',
      'New draft project created. Complete the fields and save.'
    );
  }

  async function duplicateProject(id) {
    if (formDirty && !confirm('Duplicate the last saved version and discard unsaved changes?')) return;
    const source = workingProjects.find(project => project.id === id);
    if (!source) return;

    const slug = uniqueSlug(`${source.slug || source.id || 'project'}-copy`);
    const duplicate = {
      ...source,
      projectStills: normalizeProjectStills(source.projectStills).map(still => ({ ...still })),
      id: slug,
      slug: slug,
      title: `${source.title} COPY`,
      published: false,
      order: Number(source.order) + 1
    };

    workingProjects.push(duplicate);
    workingProjects = adminStorage.setOrder(
      workingProjects,
      managedSection,
      { id: duplicate.id, slug: duplicate.slug },
      duplicate.order
    );
    adminStorage.save(workingProjects);
    selectedId = duplicate.id;
    formDirty = false;
    updateOverrideNotice();
    renderProjectList();
    renderEditForm(workingProjects.find(project => project.id === duplicate.id));
    await syncAndReport('Project duplicated in Supabase as an unpublished draft.');
  }

  async function deleteProject(id) {
    const project = workingProjects.find(item => item.id === id);
    if (!project) return;
    if (!confirm(`Delete “${project.title}”?\n\nReset Local Changes can restore source projects.`)) return;

    workingProjects = adminStorage.deleteProject(workingProjects, project);
    selectedId = null;
    formDirty = false;
    updateOverrideNotice();
    renderProjectList();
    clearForm();
    if (!remoteEnabled) {
      showStatus('Project deleted and section order updated.', 'success');
      return;
    }
    showStatus('Deleting project from Supabase…', 'info');
    try {
      await deleteRemoteProjectAndSync(id);
      showStatus('Project deleted from Supabase and section order updated.', 'success');
    } catch (error) {
      showStatus(`Deleted locally, but Supabase failed: ${error.message || error}`, 'error');
    }
  }

  // ─── Save ────────────────────────────────────────────────────

  async function saveProject(id) {
    const form = dom.form;
    if (!form) return;

    const idx = workingProjects.findIndex(p => p.id === id);
    if (idx === -1) return;

    const updated = { ...workingProjects[idx] };
    const previousSection = updated.section;

    form.querySelectorAll('[data-field]').forEach(el => {
      const field = el.getAttribute('data-field');
      const raw = el.value.trim();

      if (field === 'order') {
        updated[field] = parseInt(raw, 10) || updated[field];
      } else if (
        field === 'desktopFocusX' || field === 'desktopFocusY' ||
        field === 'heroFocusX' || field === 'heroFocusY' ||
        field === 'mobileFocusX' || field === 'mobileFocusY'
      ) {
        updated[field] = Math.max(0, Math.min(100, Number(raw) || 0));
      } else if (
        field === 'desktopCoverScale' || field === 'heroCoverScale' ||
        field === 'mobileCoverScale'
      ) {
        updated[field] = normalizeCoverScale(raw);
      } else if (field === 'published' || field === 'watchNowEnabled') {
        updated[field] = raw === 'true';
      } else if (PROJECT_I18N_FIELDS.includes(field) && projectEditingLocale === 'en') {
        const value = field === 'services'
          ? [...new Set(raw.split(',').map(item => item.trim()).filter(Boolean))]
          : raw;
        setEnglishTranslation(updated, field, value);
      } else if (field === 'services') {
        updated[field] = [...new Set(raw.split(',').map(item => item.trim()).filter(Boolean))];
      } else {
        updated[field] = raw;
      }
    });
    updated.projectStills = normalizeProjectStills(
      Array.from(form.querySelectorAll('[data-still-url]')).map(input => {
        const index = input.getAttribute('data-still-url');
        const sizeInput = form.querySelector(`[data-still-size="${index}"]`);
        return {
          url: input.value.trim(),
          size: sizeInput ? sizeInput.value : '16-9'
        };
      })
    );
    if (!updated.title) {
      showStatus('ERROR: Title cannot be empty.', 'error');
      return;
    }
    if (!updated.slug) {
      showStatus('ERROR: Slug cannot be empty.', 'error');
      return;
    }
    if (updated.youtubeUrl) {
      const youtubeUrl = getYouTubeWatchUrl(updated.youtubeUrl);
      if (!youtubeUrl) {
        showStatus('ERROR: Enter a valid YouTube video URL.', 'error');
        return;
      }
      updated.youtubeUrl = youtubeUrl;
    }
    if (updated.watchNowUrl) {
      let watchNowUrl;
      try {
        watchNowUrl = new URL(updated.watchNowUrl);
      } catch (error) {
        showStatus('ERROR: Enter a valid Watch Now URL.', 'error');
        return;
      }
      if (!['http:', 'https:'].includes(watchNowUrl.protocol)) {
        showStatus('ERROR: Watch Now must use an http:// or https:// URL.', 'error');
        return;
      }
      updated.watchNowUrl = watchNowUrl.toString();
    }
    if (updated.watchNowEnabled && !updated.watchNowUrl) {
      showStatus('ERROR: Add a Watch Now URL before enabling the button.', 'error');
      return;
    }
    const duplicateSlug = workingProjects.some(project =>
      project.id !== id && project.slug === updated.slug
    );
    if (duplicateSlug) {
      showStatus(`ERROR: Slug “${updated.slug}” is already in use.`, 'error');
      return;
    }
    if (!Number.isInteger(updated.order) || updated.order < 1) {
      showStatus('ERROR: Display Order must be a whole number greater than 0.', 'error');
      return;
    }

    const saveButton = document.getElementById('btn-save');
    const savedRevision = formRevision;
    const targetSectionLabel = getSectionLabel(updated.section);
    beginFormSave(saveButton);

    const requestedOrder = updated.order;
    workingProjects[idx] = updated;
    workingProjects = adminStorage.setOrder(
      workingProjects,
      updated.section,
      { id: updated.id, slug: updated.slug },
      requestedOrder
    );
    if (previousSection !== updated.section) {
      workingProjects = adminStorage.normalizeOrder(workingProjects, previousSection);
    }

    adminStorage.save(workingProjects);
    formDirty = false;

    updateOverrideNotice();
    renderProjectList();
    if (updated.section !== managedSection) {
      selectedId = null;
      clearForm();
    }
    const remoteSynced = await syncAndReport(
      previousSection !== updated.section
        ? `Project moved to ${targetSectionLabel} and saved to Supabase.`
        : 'Project changes saved to Supabase.',
      previousSection !== updated.section
        ? `Project moved to ${targetSectionLabel} and saved locally.`
        : 'Project changes saved locally.'
    );
    finishFormSave(
      saveButton,
      savedRevision,
      remoteSynced,
      remoteEnabled ? 'Saved to Supabase' : 'Saved locally'
    );
  }

  // ─── Reorder ─────────────────────────────────────────────────

  async function reorderProject(id, requestedIndex) {
    const sectionProjects = getSectionProjects();
    const currentIndex = sectionProjects.findIndex(project => project.id === id);
    const targetIndex = Math.max(0, Math.min(sectionProjects.length - 1, requestedIndex));
    if (currentIndex === -1 || currentIndex === targetIndex) return;

    const project = sectionProjects[currentIndex];
    workingProjects = adminStorage.setOrder(
      workingProjects,
      managedSection,
      { id: project.id, slug: project.slug },
      targetIndex + 1
    );

    adminStorage.save(workingProjects);
    updateOverrideNotice();
    renderProjectList();

    // Preserve any unsaved form fields while keeping its order value accurate.
    const selectedProject = workingProjects.find(projectItem => projectItem.id === selectedId);
    const orderField = document.getElementById('field-order');
    if (selectedProject && orderField) {
      orderField.value = String(selectedProject.order);
    }

    await syncAndReport('Order updated in Supabase.', 'Order updated.');
  }

  // ─── Preview ─────────────────────────────────────────────────

  function openPreview(url) {
    const preview = window.open(url, '_blank', 'noopener,noreferrer');
    if (preview) preview.opener = null;
  }

  function previewGallery() {
    const gallery = workingGalleries.find(item => item.id === managedSection);
    openPreview(getGalleryHref(gallery?.slug || managedSection));
  }

  // ─── Export ──────────────────────────────────────────────────

  function exportJson() {
    const backup = adminStorage.exportFullBackup(workingGalleries, workingProjects, workingSettings);
    showStatus(
      `Full backup exported: ${backup.counts.sections} sections, ${backup.counts.projects} projects and ${backup.counts.media} media references.`,
      'success'
    );
  }

  // ─── Import ──────────────────────────────────────────────────

  function triggerImport() {
    const fileInput = dom.importFile;
    if (fileInput) fileInput.click();
  }

  async function restoreFullBackup(payload) {
    const errors = adminStorage.validateFullBackup(payload);
    if (errors.length) {
      showStatus('BACKUP VALIDATION ERRORS:\n' + errors.join('\n'), 'error');
      return;
    }

    const confirmed = confirm(
      `Restore this full portfolio backup?\n\n` +
      `${payload.galleries.length} section(s)\n${payload.projects.length} project(s)\n` +
      `${Array.isArray(payload.media) ? payload.media.length : 0} media reference(s)\n\n` +
      'Current local content will be replaced. Matching Supabase rows will be updated; unrelated remote rows are not deleted.'
    );
    if (!confirmed) return;

    workingGalleries = adminStorage.normalizeGalleryOrder(JSON.parse(JSON.stringify(payload.galleries)));
    workingProjects = JSON.parse(JSON.stringify(payload.projects));
    workingGalleries.forEach(gallery => {
      workingProjects = adminStorage.normalizeOrder(workingProjects, gallery.id);
    });
    workingSettings = window.siteSettings
      ? siteSettings.saveLocal(payload.settings)
      : JSON.parse(JSON.stringify(payload.settings));

    adminStorage.saveGalleries(workingGalleries, []);
    adminStorage.save(workingProjects, []);
    managedSection = workingGalleries[0]?.id || '';
    selectedId = null;
    formDirty = false;

    if (remoteEnabled) {
      showStatus('Restoring the full backup to Supabase…', 'info');
      try {
        await syncPortfolioSnapshot();
        await portfolioBackend.saveSiteSettings(workingSettings);
      } catch (error) {
        showStatus(`Restored locally, but Supabase failed: ${error.message || error}`, 'error');
        renderSectionSelect();
        renderProjectList();
        clearForm();
        updateOverrideNotice();
        return;
      }
    }

    renderSectionSelect();
    renderProjectList();
    clearForm();
    updateOverrideNotice();
    showStatus(
      remoteEnabled ? 'Full backup restored locally and in Supabase.' : 'Full backup restored to the local admin copy.',
      'success'
    );
  }

  function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showStatus('ERROR: JSON import files must be smaller than 2 MB.', 'error');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async function (ev) {
      let payload;
      try {
        payload = JSON.parse(ev.target.result);
      } catch (err) {
        showStatus('ERROR: File is not valid JSON. No changes made.', 'error');
        return;
      }

      if (payload?.backupType === 'artur-portfolio-full') {
        await restoreFullBackup(payload);
        return;
      }

      const errors = adminStorage.validate(payload);
      if (errors.length > 0) {
        showStatus('VALIDATION ERRORS:\n' + errors.join('\n'), 'error');
        return;
      }

      if (payload.section && payload.section !== managedSection) {
        showStatus(
          `ERROR: This file belongs to “${payload.section}”. Select that section before importing it.`,
          'error'
        );
        return;
      }

      // Merge: replace only projects matching this section; keep others intact
      const importedSectionProjects = payload.projects.filter(p => p.section === managedSection);
      if (!importedSectionProjects.length) {
        showStatus('ERROR: This file contains no projects for the selected section.', 'error');
        return;
      }
      const otherProjects = workingProjects.filter(p => p.section !== managedSection);

      workingProjects = [...otherProjects, ...importedSectionProjects];
      workingProjects = adminStorage.normalizeOrder(workingProjects, managedSection);

      adminStorage.restoreProjects(workingProjects, importedSectionProjects);
      selectedId = null;
      formDirty = false;

      updateOverrideNotice();
      renderProjectList();
      clearForm();
      await syncAndReport(
        `Imported ${importedSectionProjects.length} projects and saved them to Supabase.`,
        `Imported ${importedSectionProjects.length} projects successfully.`
      );
    };

    reader.readAsText(file);
    // Reset input so same file can be re-imported
    e.target.value = '';
  }

  // ─── Reset ───────────────────────────────────────────────────

  async function resetOverrides() {
    const message = remoteEnabled
      ? 'Discard the local backup and reload the current data from Supabase?'
      : 'Reset all local changes and restore source project data?\n\nThis cannot be undone.';
    if (!confirm(message)) return;

    adminStorage.clear();
    if (window.siteSettings) siteSettings.clearLocal();
    workingSettings = window.siteSettings
      ? siteSettings.normalize(SITE_SETTINGS_DEFAULTS)
      : {};
    selectedId = null;
    formDirty = false;

    if (remoteEnabled) {
      try {
        const remote = await portfolioBackend.loadPortfolio({ includeDrafts: true });
        workingProjects = JSON.parse(JSON.stringify(remote.projects));
        workingGalleries = JSON.parse(JSON.stringify(remote.galleries));
        adminStorage.save(workingProjects, []);
        adminStorage.saveGalleries(workingGalleries, []);
        const remoteSettings = await portfolioBackend.loadSiteSettings();
        if (remoteSettings) workingSettings = siteSettings.saveLocal(remoteSettings);
      } catch (error) {
        loadWorkingData();
        showStatus(`Could not reload Supabase: ${error.message || error}`, 'error');
        return;
      }
    } else {
      loadWorkingData();
    }
    if (!workingGalleries.some(gallery => gallery.id === managedSection)) {
      managedSection = workingGalleries[0] ? workingGalleries[0].id : '';
    }
    renderSectionSelect();
    renderProjectList();
    clearForm();
    showStatus(
      remoteEnabled ? 'Local backup refreshed from Supabase.' : 'Reset complete. Showing source data.',
      'success'
    );
  }

  // ─── Helpers ─────────────────────────────────────────────────

  function renderSiteSettingsForm(options = {}) {
    if (!options.preserveDirty && formDirty && !confirm('You have unsaved changes. Discard them?')) return;
    selectedId = null;
    if (!options.preserveDirty) formDirty = false;
    renderProjectList();
    if (!dom.form || !dom.formWrap || !dom.emptyState) return;
    dom.formWrap.style.display = 'block';
    dom.emptyState.style.display = 'none';
    formRevision += 1;
    const settings = siteSettings.normalize(workingSettings);
    const siteText = field => translationValue(settings, settingsEditingLocale, field);
    const sitePlaceholder = field => translationPlaceholder(settings, settingsEditingLocale, field);
    const galleryTitles = new Map(workingGalleries.map(gallery => [gallery.id, gallery.title]));
    const selectableHeroProjects = workingProjects
      .filter(project => project.published !== false)
      .slice()
      .sort((a, b) => {
        const galleryA = workingGalleries.find(gallery => gallery.id === a.section);
        const galleryB = workingGalleries.find(gallery => gallery.id === b.section);
        return Number(galleryA?.order || 99) - Number(galleryB?.order || 99) ||
          Number(a.order || 99) - Number(b.order || 99);
      });
    const renderHeroProjectOptions = selectedIdentity => {
      const hasSelectedProject = selectableHeroProjects.some(project =>
        (project.id || project.slug) === selectedIdentity
      );
      const unavailableOption = selectedIdentity && !hasSelectedProject
        ? `<option value="${escAdm(selectedIdentity)}" selected>Unavailable project — ${escAdm(selectedIdentity)}</option>`
        : '';
      return `<option value="">Not selected</option>${unavailableOption}${selectableHeroProjects.map(project => {
        const identity = project.id || project.slug;
        const sectionTitle = galleryTitles.get(project.section) || project.section || 'No section';
        return `<option value="${escAdm(identity)}" ${identity === selectedIdentity ? 'selected' : ''}>${escAdm(project.title)} — ${escAdm(sectionTitle)}</option>`;
      }).join('')}`;
    };
    const usesAutomaticHeroFallback = !settings.workHeroProjectIds.length;
    const effectiveHeroProjectIds = usesAutomaticHeroFallback
      ? selectableHeroProjects
        .filter(project => project.section === 'featured-work')
        .sort((a, b) => Number(a.order || 99) - Number(b.order || 99))
        .slice(0, 3)
        .map(project => project.id || project.slug)
        .filter(Boolean)
      : settings.workHeroProjectIds;

    dom.form.innerHTML = `
      <div class="form-header">
        <h2 class="form-title" id="form-heading">Editing: <span>Global Site Settings</span></h2>
        ${localeSwitcher('settings', settingsEditingLocale)}
      </div>
      <div class="form-grid">
        <h3 class="form-section-heading">Landing Page</h3>
        <div class="form-group span-2">
          <label for="setting-landingBrowserTitle">Browser Tab Title — Optional</label>
          <input id="setting-landingBrowserTitle" type="text" maxlength="120" value="${escAdm(siteText('landingBrowserTitle'))}" data-site-field="landingBrowserTitle" data-site-i18n-field="landingBrowserTitle" placeholder="${escAdm(sitePlaceholder('landingBrowserTitle') || `${settings.landingTitle} | Portfolio`)}" />
          <span class="media-upload-note">Controls only the browser tab and shared-link title. Leave empty to use the automatic title.</span>
        </div>
        <div class="form-group">
          <label for="setting-landingTitle">Main Title</label>
          <input id="setting-landingTitle" type="text" value="${escAdm(siteText('landingTitle'))}" data-site-field="landingTitle" data-site-i18n-field="landingTitle" placeholder="${escAdm(sitePlaceholder('landingTitle'))}" />
        </div>
        <div class="form-group">
          <label for="setting-landingSubtitle">Subtitle — Optional</label>
          <input id="setting-landingSubtitle" type="text" value="${escAdm(siteText('landingSubtitle'))}" data-site-field="landingSubtitle" data-site-i18n-field="landingSubtitle" placeholder="${escAdm(sitePlaceholder('landingSubtitle'))}" />
          <span class="media-upload-note">Leave empty to hide the subtitle and move the buttons closer to the title.</span>
        </div>
        <div class="form-group">
          <label for="setting-landingEnterLabel">Enter Button Label</label>
          <input id="setting-landingEnterLabel" type="text" value="${escAdm(siteText('landingEnterLabel'))}" data-site-field="landingEnterLabel" data-site-i18n-field="landingEnterLabel" placeholder="${escAdm(sitePlaceholder('landingEnterLabel'))}" />
        </div>
        <div class="form-group">
          <label for="setting-landingWatchReelLabel">Watch Reel Button Label</label>
          <input id="setting-landingWatchReelLabel" type="text" value="${escAdm(siteText('landingWatchReelLabel'))}" data-site-field="landingWatchReelLabel" data-site-i18n-field="landingWatchReelLabel" placeholder="${escAdm(sitePlaceholder('landingWatchReelLabel'))}" />
        </div>
        <div class="form-group span-2">
          <label for="setting-landingBackgroundVideo">Landing Preview Video Path / URL</label>
          <div class="media-input-row">
            <input id="setting-landingBackgroundVideo" type="text" value="${escAdm(settings.landingBackgroundVideo)}" data-site-field="landingBackgroundVideo" />
            <button id="btn-upload-landing-video" class="btn btn-secondary" type="button">Upload Video</button>
          </div>
          <input id="file-landing-video" class="media-file-input" type="file" accept="video/mp4,video/webm" />
          <span class="media-upload-note">Loaded immediately on the homepage. For faster entry, use a compact lower-bitrate 720p MP4 or WebM loop under Supabase's 50 MB upload limit. The URL is saved only after clicking Save Site Settings.</span>
        </div>
        <div class="form-group span-2">
          <label for="setting-landingReelVideo">Full Desktop Reel Video Path / URL — Optional</label>
          <input id="setting-landingReelVideo" type="text" value="${escAdm(settings.landingReelVideo || '')}" data-site-field="landingReelVideo" placeholder="https://media.example.com/reel.mp4" />
          <span class="media-upload-note">Loaded only after Watch Reel is clicked and always starts at 0:00. Paste the full-quality R2 URL here. When empty, the preview video is reused.</span>
        </div>
        <div class="form-group span-2">
          <label for="setting-landingMobileReelVideo">Mobile Reel Video Path / URL — Optional</label>
          <div class="media-input-row">
            <input id="setting-landingMobileReelVideo" type="text" value="${escAdm(settings.landingMobileReelVideo || '')}" data-site-field="landingMobileReelVideo" placeholder="9:16 MP4 or WebM" />
            <button id="btn-upload-landing-mobile-reel-video" class="btn btn-secondary" type="button">Upload Mobile Reel</button>
          </div>
          <input id="file-landing-mobile-reel-video" class="media-file-input" type="file" accept="video/mp4,video/webm" />
          <span class="media-upload-note">Optional 9:16 version, loaded only after Watch Reel is clicked on mobile. When empty, the desktop reel is shown whole with black letterboxing.</span>
        </div>

        <h3 class="form-section-heading">Work Overview</h3>
        <div class="form-group span-2">
          <label for="setting-workBrowserTitle">Browser Tab Title — Optional</label>
          <input id="setting-workBrowserTitle" type="text" maxlength="120" value="${escAdm(siteText('workBrowserTitle'))}" data-site-field="workBrowserTitle" data-site-i18n-field="workBrowserTitle" placeholder="ARTUR ARAUJO | TRABALHOS SELECIONADOS" />
          <span class="media-upload-note">Controls only the browser tab and shared-link title. Leave empty to use the automatic localized title.</span>
        </div>
        <div class="form-group span-2">
          <label for="setting-workIntroTitle">Presentation Title — Optional</label>
          <textarea id="setting-workIntroTitle" rows="3" data-site-field="workIntroTitle" data-site-i18n-field="workIntroTitle" placeholder="${escAdm(sitePlaceholder('workIntroTitle'))}">${escAdm(siteText('workIntroTitle'))}</textarea>
        </div>
        <div class="form-group span-2">
          <label for="setting-workIntroBody">Presentation Text — Optional</label>
          <textarea id="setting-workIntroBody" rows="4" data-site-field="workIntroBody" data-site-i18n-field="workIntroBody" placeholder="${escAdm(sitePlaceholder('workIntroBody'))}">${escAdm(siteText('workIntroBody'))}</textarea>
          <span class="media-upload-note">Leave both presentation fields empty to show only the highlights and section index.</span>
        </div>
        <div class="form-group">
          <label for="setting-workHeroProject1">Highlight 1</label>
          <select id="setting-workHeroProject1" data-work-hero-slot="0">${renderHeroProjectOptions(effectiveHeroProjectIds[0] || '')}</select>
        </div>
        <div class="form-group">
          <label for="setting-workHeroProject2">Highlight 2</label>
          <select id="setting-workHeroProject2" data-work-hero-slot="1">${renderHeroProjectOptions(effectiveHeroProjectIds[1] || '')}</select>
        </div>
        <div class="form-group span-2">
          <label for="setting-workHeroProject3">Highlight 3</label>
          <select id="setting-workHeroProject3" data-work-hero-slot="2">${renderHeroProjectOptions(effectiveHeroProjectIds[2] || '')}</select>
          <span class="media-upload-note">${usesAutomaticHeroFallback
            ? 'Showing the current automatic fallback. Save Site Settings to make these choices explicit, or replace them before saving.'
            : 'Choose up to three published projects from any section. Their slot order controls the Hero order.'}</span>
        </div>

        <h3 class="form-section-heading">Section Pages</h3>
        <div class="form-group span-2">
          <label for="setting-galleryBackgroundVideo">Default Gallery Background Video Path / URL</label>
          <div class="media-input-row">
            <input id="setting-galleryBackgroundVideo" type="text" value="${escAdm(settings.galleryBackgroundVideo)}" data-site-field="galleryBackgroundVideo" />
            <button id="btn-upload-gallery-video" class="btn btn-secondary" type="button">Upload Video</button>
          </div>
          <input id="file-gallery-video" class="media-file-input" type="file" accept="video/mp4,video/webm" />
          <span class="media-upload-note">Used by sections set to “Project Selection default”. Individual sections can instead use the global solid theme, the homepage video or a custom/reused video.</span>
        </div>

        <h3 class="form-section-heading">Solid Content Theme</h3>
        <div class="form-group span-2">
          <label for="setting-contentTheme">Sections &amp; Project Pages</label>
          <select id="setting-contentTheme" data-site-field="contentTheme">
            <option value="dark" ${settings.contentTheme !== 'light' ? 'selected' : ''}>Dark — current black background</option>
            <option value="light" ${settings.contentTheme === 'light' ? 'selected' : ''}>Light — warm gallery paper</option>
          </select>
          <span class="media-upload-note">Global setting. It affects solid sections and project information pages. Navigation, mobile menu, footer, Contact and video backgrounds remain black.</span>
        </div>

        <h3 class="form-section-heading">Contact Page</h3>
        <div class="form-group span-2">
          <label for="setting-contactBrowserTitle">Browser Tab Title — Optional</label>
          <input id="setting-contactBrowserTitle" type="text" maxlength="120" value="${escAdm(siteText('contactBrowserTitle'))}" data-site-field="contactBrowserTitle" data-site-i18n-field="contactBrowserTitle" placeholder="ARTUR ARAUJO | CONTATO" />
          <span class="media-upload-note">Controls only the browser tab and shared-link title. Leave empty to use the automatic localized title.</span>
        </div>
        <div class="form-group span-2">
          <label for="setting-contactTitle">Contact Title</label>
          <input id="setting-contactTitle" type="text" value="${escAdm(siteText('contactTitle'))}" data-site-field="contactTitle" data-site-i18n-field="contactTitle" placeholder="${escAdm(sitePlaceholder('contactTitle'))}" />
        </div>
        <div class="form-group span-2">
          <label for="setting-contactIntro">Intro Text</label>
          <textarea id="setting-contactIntro" rows="3" data-site-field="contactIntro" data-site-i18n-field="contactIntro" placeholder="${escAdm(sitePlaceholder('contactIntro'))}">${escAdm(siteText('contactIntro'))}</textarea>
        </div>
        <div class="form-group">
          <label for="setting-contactAvailability">Availability</label>
          <input id="setting-contactAvailability" type="text" value="${escAdm(siteText('contactAvailability'))}" data-site-field="contactAvailability" data-site-i18n-field="contactAvailability" placeholder="${escAdm(sitePlaceholder('contactAvailability'))}" />
        </div>
        <div class="form-group">
          <label for="setting-contactLocation">Location</label>
          <input id="setting-contactLocation" type="text" value="${escAdm(siteText('contactLocation'))}" data-site-field="contactLocation" data-site-i18n-field="contactLocation" placeholder="${escAdm(sitePlaceholder('contactLocation'))}" />
        </div>
        <div class="form-group span-2">
          <label for="setting-contactSubmitLabel">Submit Button Label</label>
          <input id="setting-contactSubmitLabel" type="text" value="${escAdm(siteText('contactSubmitLabel'))}" data-site-field="contactSubmitLabel" data-site-i18n-field="contactSubmitLabel" placeholder="${escAdm(sitePlaceholder('contactSubmitLabel'))}" />
        </div>
        <h4 class="form-subsection-heading span-2">Project Categories</h4>
        <div class="form-group">
          <label for="setting-contactCategoryVfx">Category 1</label>
          <input id="setting-contactCategoryVfx" type="text" value="${escAdm(siteText('contactCategoryVfx'))}" data-site-field="contactCategoryVfx" data-site-i18n-field="contactCategoryVfx" placeholder="${escAdm(sitePlaceholder('contactCategoryVfx'))}" />
        </div>
        <div class="form-group">
          <label for="setting-contactCategoryEditing">Category 2</label>
          <input id="setting-contactCategoryEditing" type="text" value="${escAdm(siteText('contactCategoryEditing'))}" data-site-field="contactCategoryEditing" data-site-i18n-field="contactCategoryEditing" placeholder="${escAdm(sitePlaceholder('contactCategoryEditing'))}" />
        </div>
        <div class="form-group">
          <label for="setting-contactCategoryAlchemy">Category 3</label>
          <input id="setting-contactCategoryAlchemy" type="text" value="${escAdm(siteText('contactCategoryAlchemy'))}" data-site-field="contactCategoryAlchemy" data-site-i18n-field="contactCategoryAlchemy" placeholder="${escAdm(sitePlaceholder('contactCategoryAlchemy'))}" />
        </div>
        <div class="form-group">
          <label for="setting-contactCategoryFull">Category 4</label>
          <input id="setting-contactCategoryFull" type="text" value="${escAdm(siteText('contactCategoryFull'))}" data-site-field="contactCategoryFull" data-site-i18n-field="contactCategoryFull" placeholder="${escAdm(sitePlaceholder('contactCategoryFull'))}" />
        </div>
        <div class="form-group span-2">
          <label for="setting-contactCategoryOther">Other Category Label</label>
          <input id="setting-contactCategoryOther" type="text" value="${escAdm(siteText('contactCategoryOther'))}" data-site-field="contactCategoryOther" data-site-i18n-field="contactCategoryOther" placeholder="${escAdm(sitePlaceholder('contactCategoryOther'))}" />
          <span class="media-upload-note">Selecting this option opens a free-text field for the visitor.</span>
        </div>

        <h3 class="form-section-heading">Footer</h3>
        <div class="form-group span-2">
          <label for="setting-footerTitle">Footer Title</label>
          <input id="setting-footerTitle" type="text" value="${escAdm(siteText('footerTitle'))}" data-site-field="footerTitle" data-site-i18n-field="footerTitle" placeholder="${escAdm(sitePlaceholder('footerTitle'))}" />
        </div>
        <div class="form-group">
          <label for="setting-footerContactLabel">Contact Button Label</label>
          <input id="setting-footerContactLabel" type="text" value="${escAdm(siteText('footerContactLabel'))}" data-site-field="footerContactLabel" data-site-i18n-field="footerContactLabel" placeholder="${escAdm(sitePlaceholder('footerContactLabel'))}" />
        </div>
        <div class="form-group">
          <label for="setting-footerInstagramLabel">Instagram Button Label</label>
          <input id="setting-footerInstagramLabel" type="text" value="${escAdm(siteText('footerInstagramLabel'))}" data-site-field="footerInstagramLabel" data-site-i18n-field="footerInstagramLabel" placeholder="${escAdm(sitePlaceholder('footerInstagramLabel'))}" />
        </div>
        <div class="form-group span-2">
          <label for="setting-footerInstagramUrl">Instagram Profile URL</label>
          <input id="setting-footerInstagramUrl" type="text" value="${escAdm(settings.footerInstagramUrl)}" data-site-field="footerInstagramUrl" placeholder="https://instagram.com/your-profile" />
        </div>
        <div class="form-group span-2">
          <label for="setting-footerCopyright">Copyright</label>
          <input id="setting-footerCopyright" type="text" value="${escAdm(siteText('footerCopyright'))}" data-site-field="footerCopyright" data-site-i18n-field="footerCopyright" placeholder="${escAdm(sitePlaceholder('footerCopyright'))}" />
        </div>
      </div>
      <div class="form-actions">
        <button id="btn-save-site-settings" class="btn btn-primary" type="button">Save Site Settings</button>
        <button id="btn-preview-landing" class="btn btn-secondary" type="button">Preview Landing</button>
        <button id="btn-preview-work" class="btn btn-secondary" type="button">Preview Work Overview</button>
        <button id="btn-preview-contact" class="btn btn-secondary" type="button">Preview Contact</button>
        <button id="btn-preview-footer" class="btn btn-secondary" type="button">Preview Footer</button>
        <span class="form-dirty-hint" id="dirty-hint" style="display:none" role="status"></span>
      </div>`;

    dom.form.querySelectorAll('[data-site-field]').forEach(input => {
      input.addEventListener('input', markFormDirty);
    });
    dom.form.querySelectorAll('[data-work-hero-slot]').forEach(input => {
      input.addEventListener('change', markFormDirty);
    });
    bindLocaleSwitcher('settings', locale => {
      if (locale === settingsEditingLocale) return;
      const current = siteSettings.normalize(workingSettings);
      let changed = false;
      dom.form.querySelectorAll('[data-site-i18n-field]').forEach(input => {
        const field = input.getAttribute('data-site-i18n-field');
        const value = input.value.trim();
        if (translationValue(current, settingsEditingLocale, field) !== value) changed = true;
        if (settingsEditingLocale === 'en') setEnglishTranslation(current, field, value);
        else current[field] = value;
      });
      workingSettings = current;
      settingsEditingLocale = locale;
      if (changed) markFormDirty();
      dom.form.querySelectorAll('[data-site-i18n-field]').forEach(input => {
        const field = input.getAttribute('data-site-i18n-field');
        input.value = translationValue(current, locale, field);
        input.placeholder = translationPlaceholder(current, locale, field);
      });
      updateLocaleSwitcher('settings', locale);
    });
    document.getElementById('btn-save-site-settings').addEventListener('click', saveSiteSettings);
    document.getElementById('btn-preview-landing').addEventListener('click', () => openPreview('/'));
    document.getElementById('btn-preview-work').addEventListener('click', () => openPreview(getPortfolioOverviewHref()));
    document.getElementById('btn-preview-contact').addEventListener('click', () => openPreview('/contact'));
    document.getElementById('btn-preview-footer').addEventListener('click', () => {
      const featured = workingGalleries.find(gallery => gallery.id === 'featured-work');
      openPreview(`${getGalleryHref(featured?.slug || 'featured-work')}#site-footer`);
    });
    bindSiteVideoUpload('landing', 'landingBackgroundVideo');
    bindSiteVideoUpload('landing-mobile-reel', 'landingMobileReelVideo');
    bindSiteVideoUpload('gallery', 'galleryBackgroundVideo');
  }

  function bindSiteVideoUpload(kind, field) {
    const button = document.getElementById(`btn-upload-${kind}-video`);
    const fileInput = document.getElementById(`file-${kind}-video`);
    if (!button || !fileInput) return;
    button.addEventListener('click', () => {
      if (!remoteEnabled) return showStatus('ERROR: Sign in to Supabase before uploading media.', 'error');
      fileInput.click();
    });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      if (!['video/mp4', 'video/webm'].includes(file.type)) {
        showStatus(`ERROR: The ${kind} background must be an MP4 or WebM video.`, 'error');
        fileInput.value = '';
        return;
      }
      const originalLabel = button.textContent;
      button.disabled = true;
      button.textContent = 'Uploading…';
      try {
        const publicUrl = await portfolioBackend.uploadMedia(file, `site/${kind}`);
        const input = document.getElementById(`setting-${field}`);
        if (input) input.value = publicUrl;
        markFormDirty();
        showStatus('Upload complete. Click Save Site Settings to publish it.', 'success');
      } catch (error) {
        showStatus(`UPLOAD ERROR: ${error.message || error}`, 'error');
      } finally {
        button.disabled = false;
        button.textContent = originalLabel;
        fileInput.value = '';
      }
    });
  }

  function bindGalleryVideoUpload(galleryId) {
    const button = document.getElementById('btn-upload-gallery-background');
    const fileInput = document.getElementById('file-gallery-background');
    const urlInput = document.getElementById('gallery-background-video');
    if (!button || !fileInput || !urlInput) return;
    button.addEventListener('click', () => {
      if (!remoteEnabled) return showStatus('ERROR: Sign in to Supabase before uploading media.', 'error');
      fileInput.click();
    });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      if (!['video/mp4', 'video/webm'].includes(file.type)) {
        showStatus('ERROR: The section background must be an MP4 or WebM video.', 'error');
        fileInput.value = '';
        return;
      }
      const originalLabel = button.textContent;
      button.disabled = true;
      button.textContent = 'Uploading…';
      try {
        const safeGalleryId = String(galleryId).replace(/[^a-z0-9_-]+/gi, '-');
        urlInput.value = await portfolioBackend.uploadMedia(file, `sections/${safeGalleryId}/background`);
        urlInput.dispatchEvent(new Event('input', { bubbles: true }));
        showStatus('Upload complete. Click Save Section to publish it.', 'success');
      } catch (error) {
        showStatus(`UPLOAD ERROR: ${error.message || error}`, 'error');
      } finally {
        button.disabled = false;
        button.textContent = originalLabel;
        fileInput.value = '';
      }
    });
  }

  async function saveSiteSettings() {
    const updated = { ...workingSettings };
    dom.form.querySelectorAll('[data-site-field]').forEach(input => {
      const field = input.getAttribute('data-site-field');
      const value = input.value.trim();
      if (SITE_I18N_FIELDS.includes(field) && settingsEditingLocale === 'en') {
        setEnglishTranslation(updated, field, value);
      } else {
        updated[field] = value;
      }
    });
    updated.workHeroProjectIds = [...dom.form.querySelectorAll('[data-work-hero-slot]')]
      .map(input => input.value.trim())
      .filter(Boolean);
    if (!updated.workHeroProjectIds.length) {
      showStatus('ERROR: Choose at least one Work Overview highlight.', 'error');
      return;
    }
    if (new Set(updated.workHeroProjectIds).size !== updated.workHeroProjectIds.length) {
      showStatus('ERROR: Each Work Overview highlight must use a different project.', 'error');
      return;
    }
    const required = [
      'landingTitle', 'landingEnterLabel', 'landingWatchReelLabel', 'landingBackgroundVideo', 'galleryBackgroundVideo', 'contentTheme',
      'contactTitle', 'contactIntro', 'contactAvailability', 'contactLocation', 'contactSubmitLabel',
      'contactCategoryVfx', 'contactCategoryEditing', 'contactCategoryAlchemy', 'contactCategoryFull',
      'contactCategoryOther',
      'footerTitle', 'footerContactLabel', 'footerInstagramLabel', 'footerInstagramUrl', 'footerCopyright'
    ];
    if (required.some(field => !updated[field])) {
      showStatus('ERROR: Complete all required site settings fields.', 'error');
      return;
    }
    try {
      const instagramUrl = new URL(updated.footerInstagramUrl);
      if (!['http:', 'https:'].includes(instagramUrl.protocol)) throw new Error('Invalid protocol.');
      updated.footerInstagramUrl = instagramUrl.toString();
    } catch (error) {
      showStatus('ERROR: Enter a valid Instagram http:// or https:// URL.', 'error');
      return;
    }

    const saveButton = document.getElementById('btn-save-site-settings');
    const savedRevision = formRevision;
    beginFormSave(saveButton);
    workingSettings = siteSettings.saveLocal(updated);
    formDirty = false;
    if (!remoteEnabled) {
      showStatus('Site settings saved locally.', 'success');
      finishFormSave(saveButton, savedRevision, true, 'Saved locally');
      return;
    }
    showStatus('Saving site settings to Supabase…', 'info');
    try {
      await portfolioBackend.saveSiteSettings(workingSettings);
      showStatus('Site settings saved to Supabase.', 'success');
      finishFormSave(saveButton, savedRevision, true, 'Saved to Supabase');
    } catch (error) {
      showStatus(`Saved locally, but Supabase failed: ${error.message || error}`, 'error');
      finishFormSave(saveButton, savedRevision, false, '');
    }
  }

  function clearForm() {
    const wrap = dom.formWrap;
    const empty = dom.emptyState;
    if (wrap) wrap.style.display = 'none';
    if (empty) empty.style.display = 'flex';
  }

  function getSectionLabel(section) {
    if (dom.sectionSelect) {
      const option = Array.from(dom.sectionSelect.options)
        .find(item => item.value === section);
      if (option) return option.textContent;
    }
    return section.replace(/-/g, ' ');
  }

  // ─── Gallery Sections ───────────────────────────────────────

  async function createGallery() {
    if (formDirty && !confirm('You have unsaved changes. Discard them?')) return;
    const idToken = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const id = uniqueGalleryId(`section-${idToken}`);
    const gallery = {
      id,
      slug: uniqueGallerySlug('untitled-section'),
      previousSlugs: [],
      title: 'UNTITLED SECTION',
      browserTitle: '',
      description: '',
      published: false,
      order: workingGalleries.length + 1,
      backgroundEnabled: true,
      backgroundSource: 'default',
      backgroundVideo: '',
      translations: { en: {} }
    };
    workingGalleries.push(gallery);
    adminStorage.saveGalleries(workingGalleries);
    managedSection = gallery.id;
    selectedId = null;
    formDirty = false;
    renderSectionSelect();
    renderProjectList();
    renderGalleryForm(gallery);
    updateOverrideNotice();
    await syncAndReport(
      'New hidden section created in Supabase. Edit and publish it when ready.',
      'New hidden section created. Edit and publish it when ready.'
    );
  }

  function editGallery() {
    const gallery = workingGalleries.find(item => item.id === managedSection);
    if (gallery) renderGalleryForm(gallery);
  }

  function getReusableBackgroundVideos(currentGalleryId) {
    const videos = [];
    const seen = new Set();
    const add = (label, url) => {
      const normalized = typeof url === 'string' ? url.trim() : '';
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      videos.push({ label, url: normalized });
    };
    add('Site Settings — Project Selection', workingSettings.galleryBackgroundVideo);
    add('Site Settings — Homepage', workingSettings.landingBackgroundVideo);
    workingGalleries.forEach(item => {
      if (item.id !== currentGalleryId && item.backgroundVideo) {
        add(`Section — ${item.title}`, item.backgroundVideo);
      }
    });
    return videos;
  }

  function renderGalleryForm(gallery, renderOptions = {}) {
    selectedId = null;
    if (!renderOptions.preserveDirty) formDirty = false;
    renderProjectList();
    if (!dom.form || !dom.formWrap || !dom.emptyState) return;
    dom.formWrap.style.display = 'block';
    dom.emptyState.style.display = 'none';
    formRevision += 1;
    const backgroundEnabled = gallery.backgroundEnabled !== false;
    const backgroundSource = ['default', 'homepage', 'custom'].includes(gallery.backgroundSource)
      ? gallery.backgroundSource
      : 'default';
    const reusableVideos = getReusableBackgroundVideos(gallery.id);
    const reuseOptions = reusableVideos.map(item =>
      `<option value="${escAdm(item.url)}">${escAdm(item.label)}</option>`
    ).join('');
    const galleryText = field => translationValue(gallery, galleryEditingLocale, field);
    const galleryPlaceholder = field => translationPlaceholder(gallery, galleryEditingLocale, field);
    dom.form.innerHTML = `
      <div class="form-header"><h2 class="form-title">Editing section: <span>${escAdm(gallery.title)}</span></h2>${localeSwitcher('gallery', galleryEditingLocale)}</div>
      <div class="form-grid">
        <div class="form-group">
          <label for="gallery-title">Section Title</label>
          <input id="gallery-title" type="text" value="${escAdm(galleryText('title'))}" data-gallery-field="title" data-gallery-i18n-field="title" placeholder="${escAdm(galleryPlaceholder('title'))}" />
        </div>
        <div class="form-group">
          <label for="gallery-id">Internal ID</label>
          <input id="gallery-id" type="text" value="${escAdm(gallery.id)}" readonly />
          <span class="media-upload-note">Stable database key. Projects remain connected to this value when the URL changes.</span>
        </div>
        <div class="form-group">
          <label for="gallery-slug">URL Slug</label>
          <input id="gallery-slug" type="text" value="${escAdm(gallery.slug || gallery.id)}" data-gallery-field="slug" placeholder="featured-work" />
          <span class="media-upload-note">Editable public address. Previous slugs keep resolving to this section.</span>
        </div>
        <div class="form-group span-2">
          <label for="gallery-browser-title">Browser Tab Title — Optional</label>
          <input id="gallery-browser-title" type="text" maxlength="120" value="${escAdm(galleryText('browserTitle'))}" data-gallery-field="browserTitle" data-gallery-i18n-field="browserTitle" placeholder="${escAdm(galleryPlaceholder('browserTitle') || `ARTUR ARAUJO | ${gallery.title}`)}" />
          <span class="media-upload-note">Controls the browser tab and shared-link title. Leave empty to use “ARTUR ARAUJO | Section Title”.</span>
        </div>
        <div class="form-group span-2">
          <label for="gallery-description">Description</label>
          <input id="gallery-description" type="text" value="${escAdm(galleryText('description'))}" data-gallery-field="description" data-gallery-i18n-field="description" placeholder="${escAdm(galleryPlaceholder('description'))}" />
        </div>
        <div class="form-group">
          <label for="gallery-order">Menu Order</label>
          <input id="gallery-order" type="number" min="1" value="${gallery.order}" data-gallery-field="order" />
        </div>
        <div class="form-group">
          <label for="gallery-published">Visibility</label>
          <select id="gallery-published" data-gallery-field="published">
            <option value="true" ${gallery.published !== false ? 'selected' : ''}>Published — visible in menu</option>
            <option value="false" ${gallery.published === false ? 'selected' : ''}>Hidden — admin only</option>
          </select>
        </div>
        <h3 class="form-section-heading">Section Background</h3>
        <div class="form-group span-2">
          <label for="gallery-background-enabled">Background Style</label>
          <select id="gallery-background-enabled" data-gallery-field="backgroundEnabled">
            <option value="true" ${backgroundEnabled ? 'selected' : ''}>Video enabled — show video and film effects</option>
            <option value="false" ${!backgroundEnabled ? 'selected' : ''}>Video disabled — solid theme</option>
          </select>
          <span class="media-upload-note">The solid background follows the global Solid Content Theme used by project pages and does not load or play the section video.</span>
        </div>
        <div id="gallery-background-options" class="form-group span-2" ${backgroundEnabled ? '' : 'hidden'}>
          <label for="gallery-background-source">Video Source</label>
          <select id="gallery-background-source" data-gallery-field="backgroundSource">
            <option value="default" ${backgroundSource === 'default' ? 'selected' : ''}>Project Selection default — from Site Settings</option>
            <option value="homepage" ${backgroundSource === 'homepage' ? 'selected' : ''}>Homepage video — follows Site Settings automatically</option>
            <option value="custom" ${backgroundSource === 'custom' ? 'selected' : ''}>Custom or reused video</option>
          </select>
        </div>
        <div id="gallery-custom-background-options" class="form-group span-2" ${backgroundEnabled && backgroundSource === 'custom' ? '' : 'hidden'}>
          <label for="gallery-background-reuse">Reuse Existing Video</label>
          <select id="gallery-background-reuse">
            <option value="">Choose a video already used by the site…</option>
            ${reuseOptions}
          </select>
          <span class="media-upload-note">This copies only the existing public URL. No file is uploaded or duplicated.</span>
          <label for="gallery-background-video">Custom Video URL</label>
          <div class="media-input-row">
            <input id="gallery-background-video" type="text" value="${escAdm(gallery.backgroundVideo || '')}" data-gallery-field="backgroundVideo" placeholder="https://…/background.mp4" />
            <button id="btn-upload-gallery-background" class="btn btn-secondary" type="button">Upload Video</button>
            <input id="file-gallery-background" class="media-file-input" type="file" accept="video/mp4,video/webm,.mp4,.webm" />
          </div>
          <span class="media-upload-note">MP4 or WebM. Uploading creates one shared URL that other sections can reuse.</span>
        </div>
      </div>
      <div class="form-actions">
        <button id="btn-save-gallery" class="btn btn-primary" type="button">Save Section</button>
        <button id="btn-preview" class="btn btn-secondary" type="button">Preview Section</button>
        <span class="form-dirty-hint" id="dirty-hint" style="display:none" role="status"></span>
      </div>`;
    dom.form.querySelectorAll('[data-gallery-field]').forEach(input => {
      input.addEventListener('input', markFormDirty);
    });
    bindLocaleSwitcher('gallery', locale => {
      if (locale === galleryEditingLocale) return;
      const currentIndex = workingGalleries.findIndex(item => item.id === gallery.id);
      if (currentIndex === -1) return;
      const current = { ...workingGalleries[currentIndex] };
      let changed = false;
      dom.form.querySelectorAll('[data-gallery-i18n-field]').forEach(input => {
        const field = input.getAttribute('data-gallery-i18n-field');
        const value = input.value.trim();
        if (translationValue(current, galleryEditingLocale, field) !== value) changed = true;
        if (galleryEditingLocale === 'en') setEnglishTranslation(current, field, value);
        else current[field] = value;
      });
      workingGalleries[currentIndex] = current;
      galleryEditingLocale = locale;
      if (changed) markFormDirty();
      dom.form.querySelectorAll('[data-gallery-i18n-field]').forEach(input => {
        const field = input.getAttribute('data-gallery-i18n-field');
        input.value = translationValue(current, locale, field);
        input.placeholder = translationPlaceholder(current, locale, field);
      });
      updateLocaleSwitcher('gallery', locale);
    });
    document.getElementById('btn-save-gallery').addEventListener('click', () => saveGallery(gallery.id));
    document.getElementById('btn-preview').addEventListener('click', previewGallery);
    const enabledSelect = document.getElementById('gallery-background-enabled');
    const sourceSelect = document.getElementById('gallery-background-source');
    const options = document.getElementById('gallery-background-options');
    const customOptions = document.getElementById('gallery-custom-background-options');
    const syncBackgroundControls = () => {
      const enabled = enabledSelect.value === 'true';
      options.hidden = !enabled;
      customOptions.hidden = !enabled || sourceSelect.value !== 'custom';
    };
    enabledSelect.addEventListener('change', syncBackgroundControls);
    sourceSelect.addEventListener('change', syncBackgroundControls);
    document.getElementById('gallery-background-reuse').addEventListener('change', event => {
      if (!event.target.value) return;
      const input = document.getElementById('gallery-background-video');
      input.value = event.target.value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    bindGalleryVideoUpload(gallery.id);
  }

  async function saveGallery(id) {
    const index = workingGalleries.findIndex(gallery => gallery.id === id);
    if (index === -1) return;
    const updated = { ...workingGalleries[index] };
    dom.form.querySelectorAll('[data-gallery-field]').forEach(input => {
      const field = input.getAttribute('data-gallery-field');
      if (GALLERY_I18N_FIELDS.includes(field) && galleryEditingLocale === 'en') {
        setEnglishTranslation(updated, field, input.value.trim());
      }
      else if (field === 'published' || field === 'backgroundEnabled') {
        updated[field] = input.value === 'true';
      }
      else if (field === 'order') updated[field] = Number.parseInt(input.value, 10);
      else updated[field] = input.value.trim();
    });
    if (!updated.title) return showStatus('ERROR: Section title cannot be empty.', 'error');
    updated.slug = String(updated.slug || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!updated.slug) return showStatus('ERROR: URL Slug cannot be empty.', 'error');
    const slugConflict = workingGalleries.some(gallery => {
      if (gallery.id === id) return false;
      return [gallery.id, gallery.slug, ...(gallery.previousSlugs || [])]
        .filter(Boolean)
        .includes(updated.slug);
    });
    if (slugConflict) {
      return showStatus(`ERROR: URL Slug “${updated.slug}” is already in use.`, 'error');
    }
    const previousSlug = workingGalleries[index].slug || workingGalleries[index].id;
    const previousSlugs = new Set(updated.previousSlugs || []);
    if (previousSlug && previousSlug !== updated.slug) previousSlugs.add(previousSlug);
    previousSlugs.delete(updated.slug);
    updated.previousSlugs = [...previousSlugs];
    if (!Number.isInteger(updated.order) || updated.order < 1) {
      return showStatus('ERROR: Menu Order must be a whole number greater than 0.', 'error');
    }
    if (updated.backgroundEnabled && updated.backgroundSource === 'custom' && !updated.backgroundVideo) {
      return showStatus('ERROR: Add or reuse a video URL for this section.', 'error');
    }
    const saveButton = document.getElementById('btn-save-gallery');
    const savedRevision = formRevision;
    beginFormSave(saveButton);
    workingGalleries[index] = updated;
    managedSection = updated.id;
    workingGalleries = adminStorage.setGalleryOrder(workingGalleries, updated.id, updated.order);
    adminStorage.saveGalleries(workingGalleries);
    formDirty = false;
    renderSectionSelect();
    renderProjectList();
    updateOverrideNotice();
    if (!remoteEnabled) {
      showStatus('Section saved.', 'success');
      finishFormSave(saveButton, savedRevision, true, 'Saved locally');
      return;
    }
    showStatus('Saving section to Supabase…', 'info');
    try {
      await syncPortfolioSnapshot();
      showStatus('Section saved to Supabase.', 'success');
      finishFormSave(saveButton, savedRevision, true, 'Saved to Supabase');
    } catch (error) {
      showStatus(`Saved locally, but Supabase failed: ${error.message || error}`, 'error');
      finishFormSave(saveButton, savedRevision, false, '');
    }
  }

  async function moveGallery(direction) {
    const ordered = adminStorage.normalizeGalleryOrder(workingGalleries);
    const index = ordered.findIndex(gallery => gallery.id === managedSection);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= ordered.length) return;
    workingGalleries = adminStorage.setGalleryOrder(ordered, managedSection, target + 1);
    adminStorage.saveGalleries(workingGalleries);
    renderSectionSelect();
    updateOverrideNotice();
    await syncAndReport('Section order updated in Supabase.', 'Section order updated.');
  }

  async function deleteCurrentGallery() {
    const gallery = workingGalleries.find(item => item.id === managedSection);
    if (!gallery) return;
    const projectCount = workingProjects.filter(project => project.section === gallery.id).length;
    if (projectCount > 0) {
      showStatus(`ERROR: This section still contains ${projectCount} project(s). Delete them first.`, 'error');
      return;
    }
    if (!confirm(`Delete section “${gallery.title}”?`)) return;
    workingGalleries = adminStorage.deleteGallery(workingGalleries, gallery.id);
    managedSection = workingGalleries[0] ? workingGalleries[0].id : '';
    selectedId = null;
    formDirty = false;
    renderSectionSelect();
    renderProjectList();
    clearForm();
    updateOverrideNotice();
    if (!remoteEnabled) {
      showStatus('Section deleted.', 'success');
      return;
    }
    showStatus('Deleting section from Supabase…', 'info');
    try {
      await deleteRemoteGalleryAndSync(gallery.id);
      showStatus('Section deleted from Supabase.', 'success');
    } catch (error) {
      showStatus(`Deleted locally, but Supabase failed: ${error.message || error}`, 'error');
    }
  }

  function uniqueGalleryId(base) {
    const used = new Set(workingGalleries.map(gallery => gallery.id));
    if (!used.has(base)) return base;
    let suffix = 2;
    while (used.has(`${base}-${suffix}`)) suffix += 1;
    return `${base}-${suffix}`;
  }

  function uniqueGallerySlug(base) {
    const normalized = String(base || 'section')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'section';
    const used = new Set(workingGalleries.flatMap(gallery => [
      gallery.id,
      gallery.slug,
      ...(gallery.previousSlugs || [])
    ]).filter(Boolean));
    if (!used.has(normalized)) return normalized;
    let suffix = 2;
    while (used.has(`${normalized}-${suffix}`)) suffix += 1;
    return `${normalized}-${suffix}`;
  }

  function uniqueSlug(base) {
    const normalized = String(base || 'project')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'project';
    const used = new Set(workingProjects.flatMap(project => [project.id, project.slug]).filter(Boolean));
    if (!used.has(normalized)) return normalized;
    let suffix = 2;
    while (used.has(`${normalized}-${suffix}`)) suffix += 1;
    return `${normalized}-${suffix}`;
  }

  function changeSection(nextSection) {
    if (!workingGalleries.some(gallery => gallery.id === nextSection) || nextSection === managedSection) return;
    if (formDirty && !confirm('You have unsaved changes. Discard them?')) {
      if (dom.sectionSelect) dom.sectionSelect.value = managedSection;
      return;
    }

    managedSection = nextSection;
    selectedId = null;
    formDirty = false;
    renderProjectList();
    clearForm();
    showStatus(`Now editing ${getSectionLabel(managedSection)}.`, 'info');
  }

  function showStatus(message, type) {
    const el = dom.status;
    if (!el) return;

    el.textContent = message;
    el.className = 'status-bar status-' + (type || 'info');
    el.style.display = 'block';

    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => {
      el.style.display = 'none';
    }, type === 'error' ? 8000 : 4000);
  }

  function escAdm(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ─── Bind Top-Level Actions ──────────────────────────────────

  function bindActions() {
    const newProjectBtn = dom.newProjectBtn;
    if (newProjectBtn) newProjectBtn.addEventListener('click', createProject);

    if (dom.newSectionBtn) dom.newSectionBtn.addEventListener('click', createGallery);
    if (dom.editSectionBtn) dom.editSectionBtn.addEventListener('click', editGallery);
    if (dom.sectionUpBtn) dom.sectionUpBtn.addEventListener('click', () => moveGallery(-1));
    if (dom.sectionDownBtn) dom.sectionDownBtn.addEventListener('click', () => moveGallery(1));
    if (dom.deleteSectionBtn) dom.deleteSectionBtn.addEventListener('click', deleteCurrentGallery);
    if (dom.siteSettingsBtn) dom.siteSettingsBtn.addEventListener('click', renderSiteSettingsForm);

    const exportBtn = document.getElementById('btn-export');
    if (exportBtn) exportBtn.addEventListener('click', exportJson);

    const importBtn = document.getElementById('btn-import');
    if (importBtn) importBtn.addEventListener('click', triggerImport);

    const importFile = document.getElementById('import-file-input');
    if (importFile) importFile.addEventListener('change', handleImportFile);

    const resetBtn = document.getElementById('btn-reset');
    if (resetBtn) resetBtn.addEventListener('click', resetOverrides);

    if (dom.deploySeoBtn) dom.deploySeoBtn.addEventListener('click', deploySeoAndPreviews);

    const sectionSelect = dom.sectionSelect;
    if (sectionSelect) {
      sectionSelect.value = managedSection;
      sectionSelect.addEventListener('change', () => changeSection(sectionSelect.value));
    }

    document.addEventListener('keydown', event => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 's') return;
      const saveButton = getActiveSaveButton();
      if (!saveButton) return;
      event.preventDefault();
      if (!saveButton.disabled && formDirty) saveButton.click();
    });

    window.addEventListener('beforeunload', event => {
      if (!formDirty) return;
      event.preventDefault();
      event.returnValue = '';
    });

    document.querySelectorAll('.admin-menu-panel button').forEach(button => {
      button.addEventListener('click', () => {
        const menu = button.closest('details');
        if (menu) menu.removeAttribute('open');
      });
    });
  }

  // ─── Start ───────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', init);

}());
