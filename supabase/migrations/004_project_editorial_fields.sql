-- Portfolio VFX — editorial context, personal contribution and selected credits.

alter table public.portfolio_projects
  add column if not exists services text[] not null default '{}',
  add column if not exists project_summary text not null default '',
  add column if not exists contribution text not null default '',
  add column if not exists director text not null default '',
  add column if not exists production_company text not null default '';

-- Make the new columns available to the Supabase Data API immediately.
notify pgrst, 'reload schema';
