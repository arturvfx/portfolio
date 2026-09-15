(function () {
  'use strict';
  // A work preview belongs to one landing → work navigation only. Discard a
  // preview left by an older visit before requesting the current highlights.
  window.sectionEntryPreview?.clear('work');
  window.sectionEntryPreview?.preload('work');
  const settingsReady = window.siteSettings?.hydrate();

  // Keep the landing black until its current settings are known, then paint
  // one complete black frame before the title ignites. No old title, copy or
  // background source can appear during the request.
  Promise.resolve(settingsReady).finally(() => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.body.classList.add('landing-intro-ready');
      });
    });
  });
}());
