(function () {
  'use strict';
  window.sectionEntryPreview?.preload('work');
  window.siteSettings?.hydrate();

  // Let the browser paint one genuinely black frame before the projected
  // title ignites. The second animation frame prevents a cached/local settings
  // response from skipping the visual starting state.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      document.body.classList.add('landing-intro-ready');
    });
  });
}());
