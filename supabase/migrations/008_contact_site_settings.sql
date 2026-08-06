-- Portfolio VFX — add editable Contact page copy to existing global settings.

update public.portfolio_site_settings
set settings = jsonb_build_object(
  'contactTitle', 'LET''S WORK TOGETHER',
  'contactIntro', 'Available for film productions, VFX projects and creative consulting.',
  'contactAvailability', 'AVAILABLE FOR NEW PROJECTS',
  'contactLocation', 'SÃO PAULO / REMOTE WORLDWIDE',
  'contactSubmitLabel', 'SEND MESSAGE',
  'contactCategoryVfx', 'VFX & COMPOSITING',
  'contactCategoryEditing', 'CONTENT EDITING',
  'contactCategoryAlchemy', 'DIGITAL ALCHEMY & 3D SIMULATION',
  'contactCategoryFull', 'POST-PRODUCTION DIRECTION',
  'contactCategoryOther', 'OTHER'
) || settings
where id = 'global';

notify pgrst, 'reload schema';
