-- Configurable mobile focal point for project cover imagery.
-- Existing projects remain centered at 50% / 50%.

alter table public.portfolio_projects
  add column if not exists mobile_focus_x numeric not null default 50
    check (mobile_focus_x between 0 and 100),
  add column if not exists mobile_focus_y numeric not null default 50
    check (mobile_focus_y between 0 and 100);
