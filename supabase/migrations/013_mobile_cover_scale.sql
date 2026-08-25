-- Optional mobile zoom for project cover imagery.
-- 100 keeps the current crop; values up to 200 progressively zoom in.

alter table public.portfolio_projects
  add column if not exists mobile_cover_scale numeric not null default 100
    check (mobile_cover_scale between 100 and 200);
