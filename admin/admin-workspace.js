/* Presentation only: move existing controls without cloning or replacing values. */
(function () {
  'use strict';

  function tabs(form, groups, prefix) {
    const nav = document.createElement('div');
    nav.className = 'editor-tabs';
    nav.setAttribute('role', 'tablist');
    nav.setAttribute('aria-label', 'Editor sections');
    const activate = index => groups.forEach((group, i) => {
      group.panel.hidden = i !== index;
      group.button.setAttribute('aria-selected', String(i === index));
      group.button.tabIndex = i === index ? 0 : -1;
    });
    groups.forEach((group, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = group.label;
      button.id = `${prefix}-tab-${i}`;
      button.setAttribute('role', 'tab');
      group.panel.id = `${prefix}-panel-${i}`;
      group.panel.setAttribute('role', 'tabpanel');
      group.panel.setAttribute('aria-labelledby', button.id);
      button.setAttribute('aria-controls', group.panel.id);
      group.button = button;
      button.addEventListener('click', () => activate(i));
      button.addEventListener('keydown', event => {
        let next;
        if (event.key === 'ArrowRight') next = (i + 1) % groups.length;
        if (event.key === 'ArrowLeft') next = (i + groups.length - 1) % groups.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = groups.length - 1;
        if (next === undefined) return;
        event.preventDefault();
        activate(next);
        groups[next].button.focus();
      });
      nav.append(button);
    });
    form.querySelector('.form-header').after(nav);
    activate(0);
  }

  function project(form) {
    const grid = form.querySelector('.form-grid');
    const cards = [...grid.querySelectorAll(':scope > .form-card')];
    const media = document.createElement('div');
    media.className = 'editor-panel';
    const publication = cards[1];
    const workspace = publication.querySelector('.gallery-media-workspace');
    media.append(workspace, cards[2]);
    // Aspect ratio belongs beside its previews, not visibility and ordering.
    workspace.querySelector('.gallery-media-fields').prepend(form.querySelector('#field-size').closest('.form-group'));
    publication.querySelector('.form-card-title').textContent = 'Publication & ordering';
    publication.querySelector('.form-card-description').textContent = 'URL, section, visibility and position in the gallery.';
    grid.append(media);
    tabs(form, [
      {label: 'Content', panel: cards[0]},
      {label: 'Media', panel: media},
      {label: 'Publication', panel: publication}
    ], 'project');

    const host = form.querySelector('.cover-focus-panels');
    const panels = [...host.children];
    const label = document.createElement('label');
    label.className = 'framing-context';
    label.textContent = 'Adjust framing for';
    const select = document.createElement('select');
    select.id = 'framing-context';
    panels.forEach((panel, i) => {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = panel.querySelector('.form-subsection-heading').textContent;
      select.append(option);
    });
    const update = () => panels.forEach((panel, i) => { panel.hidden = i !== Number(select.value); });
    select.addEventListener('change', update);
    label.append(select);
    host.prepend(label);
    update();
    visualMedia(form, media, host, select);
  }

  function disclosure(title, node) {
    const details = document.createElement('details');
    details.className = 'media-details';
    const summary = document.createElement('summary');
    summary.textContent = title;
    details.append(summary, node);
    return details;
  }

  function visualMedia(form, media, host, context) {
    media.classList.add('visual-media');
    const resetPlayers = [];
    // Use the existing controls and listeners, including upload progress/error handling.
    for (const [field, title, description] of [
      ['coverImage', 'Cover image', 'The image visitors see in the gallery.'],
      ['previewVideo', 'Hover video', 'Optional motion preview when hovering over a project.'],
      ['youtubeUrl', 'Full project video', 'Played on the individual project page.']
    ]) {
      const input = form.querySelector(`#field-${field}`);
      const group = input.closest('.form-group');
      group.classList.add('visual-asset');
      group.querySelector('label').textContent = title;
      const row = group.querySelector('.media-input-row');
      const upload = row.querySelector('button');
      group.insertBefore(upload, row);
      upload.textContent = 'Upload / replace file';
      const details = disclosure('Use or edit a link', row);
      group.append(details);
      const help = group.querySelector('.media-upload-note');
      if (help) group.append(disclosure('Formats & help', help));
      const caption = document.createElement('p');
      caption.className = 'asset-caption';
      caption.textContent = description;
      const preview = document.createElement('div');
      preview.className = 'asset-preview';
      preview.dataset.assetPreview = field;
      group.insertBefore(caption, upload);
      group.insertBefore(preview, caption);
      const render = () => {
        preview.replaceChildren();
        const value = input.value.trim();
        if (!value) { preview.textContent = field === 'coverImage' ? 'Add a cover image' : 'No video — optional'; return; }
        if (field === 'coverImage') {
          const image = document.createElement('img');
          image.alt = 'Cover image preview';
          image.src = value;
          image.addEventListener('error', () => { preview.textContent = 'Image preview unavailable — check the link'; });
          preview.append(image);
          return;
        }
        const video = field === 'youtubeUrl' ? getProjectVideo(value) : {type:'file',url:value};
        if (!video) { preview.textContent = 'Unsupported video link'; return; }
        const play = document.createElement('button');
        play.type = 'button'; play.className = 'btn btn-secondary';
        play.textContent = `▶ Preview ${video.type === 'file' ? 'video' : video.type}`;
        play.addEventListener('click', () => {
          const player = document.createElement(video.type === 'file' ? 'video' : 'iframe');
          if (video.type === 'file') {
            player.controls = true; player.playsInline = true; player.preload = 'metadata'; player.src = video.url;
            player.addEventListener('error', () => { preview.textContent = 'Video preview unavailable — check the link'; });
          } else {
            player.title = 'Project video preview'; player.src = video.embedUrl;
            player.allow = 'fullscreen; picture-in-picture'; player.allowFullscreen = true;
          }
          preview.replaceChildren(player);
        });
        preview.append(play);
      };
      let timer;
      input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(render, 300); });
      render();
      if (field !== 'coverImage') resetPlayers.push(render);
    }

    // A place + device selector maps directly to the six existing independent frames.
    const toolbar = document.createElement('div');
    toolbar.className = 'frame-toolbar';
    toolbar.innerHTML = '<label>Where it appears<select id="frame-surface"><option value="thumbnail">Gallery thumbnail</option><option value="featured">Featured highlight</option><option value="project">Project page</option></select></label><label>Device<select id="frame-device"><option value="desktop">Desktop</option><option value="mobile">Mobile</option></select></label>';
    host.prepend(toolbar);
    context.closest('label').hidden = true;
    const surface = toolbar.querySelector('#frame-surface');
    const device = toolbar.querySelector('#frame-device');
    const mapping = {thumbnail:[0,2], featured:[1,5], project:[4,3]};
    const selectFrame = () => {
      context.value = String(mapping[surface.value][device.value === 'mobile' ? 1 : 0]);
      context.dispatchEvent(new Event('change'));
    };
    surface.addEventListener('change', selectFrame);
    device.addEventListener('change', selectFrame);
    host.querySelectorAll('.cover-focus-controls .media-upload-note').forEach(note => {
      const parent = note.parentElement;
      parent.append(disclosure('About this framing', note));
    });
    const hint = document.createElement('p');
    hint.className = 'asset-caption'; hint.textContent = 'Drag the image to reposition. Adjust Scale to zoom. Each place and device keeps its own framing.';
    toolbar.after(hint);
    visualStills(form);
    const deleteButton = form.querySelector('#btn-delete');
    const danger = disclosure('More actions', deleteButton);
    danger.classList.add('project-danger-menu');
    form.querySelector('.form-actions').append(danger);
    // Pause native previews when leaving Media; unload embedded players to stop audio.
    form.querySelectorAll('[role="tab"]').forEach(button => button.addEventListener('click', () => {
      if (!media.hidden) return;
      media.querySelectorAll('.asset-preview video').forEach(video => video.pause());
      resetPlayers.forEach(render => render());
    }));
  }

  function visualStills(form) {
    const gallery = form.querySelector('.project-stills-editor');
    const hint = document.createElement('p');
    hint.className = 'asset-caption span-2';
    hint.textContent = 'Select an image to change its ratio, replace it or remove it. Up to three images on the project page.';
    gallery.before(hint);
    const slots = [...gallery.children];
    const add = document.createElement('button');
    add.type = 'button'; add.className = 'add-still btn btn-secondary'; add.textContent = '＋ Add image';
    let selected = -1;
    const editors = slots.map((slot, index) => {
      const url = slot.querySelector('[data-still-url]');
      const size = slot.querySelector('[data-still-size]');
      const preview = slot.querySelector('.project-still-preview');
      const editor = document.createElement('div'); editor.className = 'still-inspector';
      const link = disclosure('Use or edit image link', url);
      editor.append(slot.querySelector('.project-still-actions'), slot.querySelector('button[id^="btn-upload"]'), link);
      slot.append(editor);
      preview.tabIndex = 0; preview.setAttribute('role','button'); preview.setAttribute('aria-label',`Edit image ${index+1}`);
      const select = () => { selected = index; refresh(); };
      preview.addEventListener('click', select);
      preview.addEventListener('keydown', event => { if (['Enter',' '].includes(event.key)) { event.preventDefault(); select(); } });
      url.addEventListener('input', () => { if (!url.value.trim()) selected = -1; refresh(); });
      size.addEventListener('change', refresh);
      return {slot,url,size,preview,editor};
    });
    function refresh() {
      editors.forEach(({slot,url,size,preview,editor}, i) => {
        slot.hidden = !url.value.trim() && selected !== i;
        editor.hidden = selected !== i;
        preview.setAttribute('aria-expanded', String(selected === i));
        preview.style.aspectRatio = size.value.replace('-', ' / ');
        slot.classList.toggle('is-selected', selected === i);
      });
      add.hidden = editors.every(item => item.url.value.trim()) || (selected !== -1 && !editors[selected].url.value.trim());
    }
    add.addEventListener('click', () => { selected = editors.findIndex(item => !item.url.value.trim()); refresh(); editors[selected]?.slot.querySelector('button[id^="btn-upload"]')?.focus(); });
    gallery.append(add);
    refresh();
  }

  function settings(form) {
    const grid = form.querySelector('.form-grid');
    const groups = [];
    let panel;
    [...grid.children].forEach(child => {
      if (child.matches('.form-section-heading')) {
        panel = document.createElement('section');
        panel.className = 'form-card form-card-grid';
        groups.push({label: child.textContent, panel});
        grid.append(panel);
      }
      if (panel) panel.append(child);
    });
    tabs(form, groups, 'settings');
  }

  function focusField(id) {
    const field = document.getElementById(id);
    const panel = field?.closest('[role="tabpanel"]');
    if (panel?.hidden) document.getElementById(panel.getAttribute('aria-labelledby'))?.click();
    const details = field?.closest('details');
    if (details) details.open = true;
    field?.focus();
  }

  window.adminWorkspace = {project, settings, focusField};
}());
