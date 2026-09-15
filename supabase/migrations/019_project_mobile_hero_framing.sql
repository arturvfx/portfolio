-- Independent framing for the hero on an individual project page on mobile.
-- Existing projects inherit their current mobile framing until edited.

alter table public.portfolio_projects
  add column if not exists project_mobile_focus_x numeric
    check (project_mobile_focus_x between 0 and 100),
  add column if not exists project_mobile_focus_y numeric
    check (project_mobile_focus_y between 0 and 100),
  add column if not exists project_mobile_cover_scale numeric
    check (project_mobile_cover_scale between 100 and 200);

notify pgrst, 'reload schema';
