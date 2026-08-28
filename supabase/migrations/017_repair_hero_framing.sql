-- Repair projects created before the Featured Hero framing migration was
-- completely applied. Safe to run on schemas where these columns exist.

alter table public.portfolio_projects
  add column if not exists hero_focus_x numeric not null default 50
    check (hero_focus_x between 0 and 100),
  add column if not exists hero_focus_y numeric not null default 50
    check (hero_focus_y between 0 and 100),
  add column if not exists hero_cover_scale numeric not null default 100
    check (hero_cover_scale between 100 and 200);

notify pgrst, 'reload schema';
