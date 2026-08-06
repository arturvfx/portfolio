-- Portfolio VFX — optional external Watch Now link and credits cleanup.

alter table public.portfolio_projects
  add column if not exists watch_now_enabled boolean not null default false,
  add column if not exists watch_now_url text not null default '',
  drop column if exists agency_studio;

-- Make the updated schema available to the Supabase Data API immediately.
notify pgrst, 'reload schema';
