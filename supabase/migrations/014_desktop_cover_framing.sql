-- Independent desktop focal point and zoom for project cover imagery.
-- Existing projects remain centered and unscaled.

alter table public.portfolio_projects
  add column if not exists desktop_focus_x numeric not null default 50
    check (desktop_focus_x between 0 and 100),
  add column if not exists desktop_focus_y numeric not null default 50
    check (desktop_focus_y between 0 and 100),
  add column if not exists desktop_cover_scale numeric not null default 100
    check (desktop_cover_scale between 100 and 200);
