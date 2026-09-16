-- Null retains the previous thumbnail framing until the project is saved.
alter table public.portfolio_projects
  add column if not exists project_desktop_focus_x numeric check (project_desktop_focus_x between 0 and 100),
  add column if not exists project_desktop_focus_y numeric check (project_desktop_focus_y between 0 and 100),
  add column if not exists project_desktop_cover_scale numeric check (project_desktop_cover_scale between 100 and 200),
  add column if not exists hero_mobile_focus_x numeric check (hero_mobile_focus_x between 0 and 100),
  add column if not exists hero_mobile_focus_y numeric check (hero_mobile_focus_y between 0 and 100),
  add column if not exists hero_mobile_cover_scale numeric check (hero_mobile_cover_scale between 100 and 200);

notify pgrst, 'reload schema';
