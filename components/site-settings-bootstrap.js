(function () {
  'use strict';
  window.siteSettingsReady = window.siteSettings?.hydrate() || Promise.resolve(null);
}());
