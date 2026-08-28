/**
 * Public bilingual layer. PT-BR is canonical; English fields fall back to PT-BR.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'portfolio-language-v1';
  const DEFAULT_LOCALE = 'pt-BR';
  const PROJECT_FIELDS = ['title', 'browserTitle', 'category', 'services', 'projectSummary', 'contribution'];
  const GALLERY_FIELDS = ['title', 'browserTitle', 'description'];
  const SITE_FIELDS = [
    'landingTitle', 'landingBrowserTitle', 'landingSubtitle', 'landingEnterLabel', 'landingWatchReelLabel',
    'workBrowserTitle', 'workIntroTitle', 'workIntroBody', 'contactTitle', 'contactBrowserTitle', 'contactIntro',
    'contactAvailability', 'contactLocation', 'contactSubmitLabel',
    'contactCategoryVfx', 'contactCategoryEditing', 'contactCategoryAlchemy',
    'contactCategoryFull', 'contactCategoryOther', 'footerTitle',
    'footerContactLabel', 'footerInstagramLabel', 'footerCopyright'
  ];
  const TEXT = {
    'pt-BR': {
      switchLanguage: 'Mudar para inglês', openMenu: 'Abrir menu', closeMenu: 'Fechar menu',
      enterPortfolio: 'Entrar no portfólio', watchReel: 'Assistir reel', closeReel: 'Fechar reel',
      workOverview: 'Visão geral do portfólio', selectedWork: 'TRABALHOS SELECIONADOS',
      viewWorkSections: 'Ver apresentação e categorias do portfólio',
      portfolioOverview: 'Visão geral do portfólio', projectSections: 'Categorias de projetos',
      client: 'CLIENTE', year: 'ANO', areasOfWork: 'ÁREAS DE ATUAÇÃO', watchNow: 'ASSISTIR AGORA',
      projectContext: 'CONTEXTO DO PROJETO', myContribution: 'MINHA CONTRIBUIÇÃO',
      credits: 'Créditos', director: 'DIREÇÃO', productionCompany: 'PRODUTORA',
      projectStills: 'Imagens do projeto', projectNotFound: 'PROJETO NÃO ENCONTRADO',
      projectNotFoundBody: 'Este projeto não existe ou não está publicado.', backToGallery: 'VOLTAR À GALERIA',
      pageNotFound: 'PÁGINA NÃO ENCONTRADA', pageNotFoundBody: 'A página que você procura não existe.', backHome: 'VOLTAR AO INÍCIO',
      contact: 'CONTATO', contactInformation: 'Informações de contato', status: 'STATUS', location: 'LOCALIZAÇÃO',
      yourName: 'SEU NOME / EMPRESA', namePlaceholder: 'Ex.: Maria Silva / Produtora',
      yourEmail: 'SEU E-MAIL DE CONTATO', projectCategory: 'CATEGORIA DO PROJETO',
      selectService: 'SELECIONE UM SERVIÇO', enterCategory: 'DIGITE UMA CATEGORIA',
      otherCategory: 'Outra categoria', projectDetails: 'DETALHES E PRAZO DO PROJETO',
      projectDetailsPlaceholder: 'Descreva brevemente o projeto, o escopo e o prazo esperado...',
      sending: 'ENVIANDO…', sendingMessage: 'ENVIANDO MENSAGEM…',
      sent: 'MENSAGEM ENVIADA. OBRIGADO PELO CONTATO.', unavailable: 'O serviço de contato está indisponível. Tente novamente mais tarde.',
      requestTimeout: 'A SOLICITAÇÃO DEMOROU DEMAIS. TENTE NOVAMENTE.', sendFailed: 'NÃO FOI POSSÍVEL ENVIAR A MENSAGEM.',
      closeImage: 'Fechar imagem', closeVideo: 'Fechar vídeo', playVideo: 'Reproduzir vídeo', noMedia: 'SEM MÍDIA',
      openStill: 'Abrir imagem do projeto', project: 'Projeto', still: 'imagem', featuredProjects: 'projetos em destaque',
      projectCounter: 'Projeto {current} de {total}'
    },
    en: {
      switchLanguage: 'Switch to Portuguese', openMenu: 'Open menu', closeMenu: 'Close menu',
      enterPortfolio: 'Enter portfolio', watchReel: 'Watch reel', closeReel: 'Close reel',
      workOverview: 'Work overview', selectedWork: 'SELECTED WORK',
      viewWorkSections: 'View portfolio introduction and sections',
      portfolioOverview: 'Portfolio overview', projectSections: 'Project sections',
      client: 'CLIENT', year: 'YEAR', areasOfWork: 'AREAS OF WORK', watchNow: 'WATCH NOW',
      projectContext: 'PROJECT CONTEXT', myContribution: 'MY CONTRIBUTION',
      credits: 'Credits', director: 'DIRECTOR', productionCompany: 'PRODUCTION COMPANY',
      projectStills: 'Project stills', projectNotFound: 'PROJECT NOT FOUND',
      projectNotFoundBody: 'This project does not exist or is not published.', backToGallery: 'BACK TO GALLERY',
      pageNotFound: 'PAGE NOT FOUND', pageNotFoundBody: 'The page you are looking for does not exist.', backHome: 'BACK HOME',
      contact: 'CONTACT', contactInformation: 'Contact information', status: 'STATUS', location: 'LOCATION',
      yourName: 'YOUR NAME / COMPANY', namePlaceholder: 'E.g. Maria Silva / Production Company',
      yourEmail: 'YOUR CONTACT EMAIL', projectCategory: 'PROJECT CATEGORY',
      selectService: 'SELECT A SERVICE', enterCategory: 'ENTER A CATEGORY',
      otherCategory: 'Other project category', projectDetails: 'PROJECT DETAILS & DEADLINE',
      projectDetailsPlaceholder: 'Briefly describe the project, scope and expected timeline...',
      sending: 'SENDING…', sendingMessage: 'SENDING MESSAGE…',
      sent: 'MESSAGE SENT. THANK YOU FOR GETTING IN TOUCH.', unavailable: 'The contact service is unavailable. Please try again later.',
      requestTimeout: 'THE REQUEST TOOK TOO LONG. PLEASE TRY AGAIN.', sendFailed: 'THE MESSAGE COULD NOT BE SENT.',
      closeImage: 'Close image', closeVideo: 'Close video', playVideo: 'Play video', noMedia: 'NO MEDIA',
      openStill: 'Open project still', project: 'Project', still: 'still', featuredProjects: 'featured projects',
      projectCounter: 'Project {current} of {total}'
    }
  };

  function normalizeLocale(value) {
    return String(value || '').toLowerCase().startsWith('en') ? 'en' : DEFAULT_LOCALE;
  }

  function getLocale() {
    try {
      return normalizeLocale(window.localStorage.getItem(STORAGE_KEY));
    } catch (error) {
      return DEFAULT_LOCALE;
    }
  }

  function setLocale(locale, options = {}) {
    const normalized = normalizeLocale(locale);
    try { window.localStorage.setItem(STORAGE_KEY, normalized); } catch (error) { /* no-op */ }
    document.documentElement.lang = normalized;
    if (options.reload !== false) window.location.reload();
    return normalized;
  }

  function t(key) {
    const locale = getLocale();
    return TEXT[locale]?.[key] || TEXT[DEFAULT_LOCALE]?.[key] || key;
  }

  function translationBucket(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function localizeFields(source, fields, locale = getLocale()) {
    const localized = { ...(source || {}) };
    if (normalizeLocale(locale) !== 'en') return localized;
    const english = translationBucket(source?.translations?.en);
    fields.forEach(field => {
      const value = english[field];
      if (Array.isArray(value)) {
        if (value.length) localized[field] = value.slice();
      } else if (typeof value === 'string' && value.trim()) {
        localized[field] = value.trim();
      }
    });
    return localized;
  }

  function localizeProject(project, locale) {
    return localizeFields(project, PROJECT_FIELDS, locale);
  }

  function localizeGallery(gallery, locale) {
    return localizeFields(gallery, GALLERY_FIELDS, locale);
  }

  function localizeSettings(settings, locale) {
    return localizeFields(settings, SITE_FIELDS, locale);
  }

  function localizePortfolio(data, locale = getLocale()) {
    return {
      ...(data || {}),
      projects: Array.isArray(data?.projects) ? data.projects.map(project => localizeProject(project, locale)) : [],
      galleries: Array.isArray(data?.galleries) ? data.galleries.map(gallery => localizeGallery(gallery, locale)) : []
    };
  }

  function applyDomTranslations(root = document) {
    document.documentElement.lang = getLocale();
    root.querySelectorAll?.('[data-i18n]').forEach(element => {
      element.textContent = t(element.getAttribute('data-i18n'));
    });
    root.querySelectorAll?.('[data-i18n-placeholder]').forEach(element => {
      element.setAttribute('placeholder', t(element.getAttribute('data-i18n-placeholder')));
    });
    root.querySelectorAll?.('[data-i18n-aria-label]').forEach(element => {
      element.setAttribute('aria-label', t(element.getAttribute('data-i18n-aria-label')));
    });
  }

  function mountToggle() {
    if (!document.body?.classList.contains('landing-page')) return;
    let button = document.querySelector('.site-language-toggle');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'site-language-toggle site-language-toggle-landing';
      document.body?.appendChild(button);
      button.addEventListener('click', () => setLocale(getLocale() === 'en' ? DEFAULT_LOCALE : 'en'));
    }
    button.textContent = getLocale() === 'en' ? 'BR' : 'EN';
    button.setAttribute('aria-label', t('switchLanguage'));
  }

  window.portfolioI18n = {
    STORAGE_KEY, DEFAULT_LOCALE, PROJECT_FIELDS, GALLERY_FIELDS, SITE_FIELDS,
    normalizeLocale, getLocale, setLocale, t, localizeProject, localizeGallery,
    localizeSettings, localizePortfolio, applyDomTranslations, mountToggle
  };

  document.documentElement.lang = getLocale();
  document.addEventListener('DOMContentLoaded', () => {
    applyDomTranslations();
    mountToggle();
  });
}());
