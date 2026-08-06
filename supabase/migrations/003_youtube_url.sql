-- Portfolio VFX — optional full-length YouTube video for project pages.

alter table public.portfolio_projects
  add column if not exists youtube_url text not null default '';

-- Make the new column available to the Supabase Data API immediately.
notify pgrst, 'reload schema';
