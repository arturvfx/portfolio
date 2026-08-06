-- Portfolio VFX — up to three aspect-ratio-aware stills per project page.

alter table public.portfolio_projects
  add column if not exists project_stills jsonb not null default '[]'::jsonb;

alter table public.portfolio_projects
  drop constraint if exists portfolio_projects_project_stills_check;

alter table public.portfolio_projects
  add constraint portfolio_projects_project_stills_check
  check (
    case when jsonb_typeof(project_stills) = 'array'
      then jsonb_array_length(project_stills) <= 3
      else false
    end
  );

notify pgrst, 'reload schema';
