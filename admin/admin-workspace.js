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
    field?.focus();
  }

  window.adminWorkspace = {project, settings, focusField};
}());
