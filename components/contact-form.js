(function () {
  'use strict';

  const tr = key => window.portfolioI18n?.t(key) || key;

  function initContactForm() {
    const form = document.getElementById('contact-form');
    const status = document.getElementById('contact-form-status');
    const submit = form && form.querySelector('[type="submit"]');
    const category = form && form.elements.category;
    const categoryOther = form && form.elements.categoryOther;
    const categoryFields = document.getElementById('contact-category-fields');
    if (!form || !status || !submit || !category || !categoryOther || !categoryFields) return;

    function syncOtherCategory() {
      const isOther = category.value === 'other';
      categoryOther.hidden = !isOther;
      categoryOther.required = isOther;
      categoryFields.classList.toggle('is-other', isOther);
      if (!isOther) categoryOther.value = '';
    }

    category.addEventListener('change', syncOtherCategory);
    syncOtherCategory();

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;

      const config = window.SUPABASE_CONFIG || {};
      if (!config.url || !config.publishableKey) {
        showStatus(status, tr('unavailable'), 'error');
        return;
      }

      const originalLabel = submit.textContent;
      submit.disabled = true;
      submit.textContent = tr('sending');
      showStatus(status, tr('sendingMessage'), 'pending');

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(`${config.url.replace(/\/$/, '')}/functions/v1/send-contact-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: config.publishableKey,
            Authorization: `Bearer ${config.publishableKey}`
          },
          body: JSON.stringify({
            name: form.elements.name.value,
            email: form.elements.email.value,
            category: category.value === 'other'
              ? categoryOther.value
              : category.options[category.selectedIndex].text,
            message: form.elements.message.value,
            website: form.elements.website.value
          }),
          signal: controller.signal
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'The message could not be sent.');

        form.reset();
        syncOtherCategory();
        showStatus(status, tr('sent'), 'success');
      } catch (error) {
        const message = error.name === 'AbortError'
          ? tr('requestTimeout')
          : String(error.message || tr('sendFailed')).toUpperCase();
        showStatus(status, message, 'error');
      } finally {
        window.clearTimeout(timeoutId);
        submit.disabled = false;
        submit.textContent = originalLabel;
      }
    });
  }

  function showStatus(element, message, state) {
    element.hidden = false;
    element.textContent = message;
    element.setAttribute('data-state', state);
  }

  document.addEventListener('DOMContentLoaded', initContactForm);
}());
