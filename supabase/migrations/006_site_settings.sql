-- Portfolio VFX — global landing, contact and footer settings.

create table if not exists public.portfolio_site_settings (
  id text primary key check (id = 'global'),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.portfolio_site_settings (id, settings)
values (
  'global',
  jsonb_build_object(
    'landingTitle', 'ARTUR ARAUJO',
    'landingSubtitle', 'VFX GENERALIST',
    'landingEnterLabel', 'ENTER',
    'landingBackgroundVideo', 'assets/videos/bg-cinema.mp4',
    'galleryBackgroundVideo', 'assets/videos/bg-cinema.mp4',
    'contactTitle', 'LET''S WORK TOGETHER',
    'contactIntro', 'Available for film productions, VFX projects and creative consulting.',
    'contactAvailability', 'AVAILABLE FOR NEW PROJECTS',
    'contactLocation', 'SÃO PAULO / REMOTE WORLDWIDE',
    'contactSubmitLabel', 'SEND MESSAGE',
    'contactCategoryVfx', 'VFX & COMPOSITING',
    'contactCategoryEditing', 'CONTENT EDITING',
    'contactCategoryAlchemy', 'DIGITAL ALCHEMY & 3D SIMULATION',
    'contactCategoryFull', 'POST-PRODUCTION DIRECTION',
    'contactCategoryOther', 'OTHER',
    'footerTitle', 'LET''S WORK TOGETHER',
    'footerContactLabel', 'CONTACT',
    'footerInstagramLabel', 'INSTAGRAM',
    'footerInstagramUrl', 'https://instagram.com',
    'footerCopyright', '© 2026 ARTUR ARAUJO'
  )
)
on conflict (id) do nothing;

drop trigger if exists set_portfolio_site_settings_updated_at on public.portfolio_site_settings;
create trigger set_portfolio_site_settings_updated_at
before update on public.portfolio_site_settings
for each row execute function public.set_updated_at();

alter table public.portfolio_site_settings enable row level security;

drop policy if exists "Site settings are public" on public.portfolio_site_settings;
create policy "Site settings are public"
on public.portfolio_site_settings for select
to anon, authenticated
using (id = 'global');

drop policy if exists "Admins can manage site settings" on public.portfolio_site_settings;
create policy "Admins can manage site settings"
on public.portfolio_site_settings for all
to authenticated
using (exists (select 1 from public.portfolio_admins admin where admin.user_id = (select auth.uid())))
with check (exists (select 1 from public.portfolio_admins admin where admin.user_id = (select auth.uid())));

notify pgrst, 'reload schema';
