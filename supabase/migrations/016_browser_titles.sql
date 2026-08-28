-- Optional, fully configurable browser-tab titles for sections and projects.
-- Empty values preserve the automatic ARTUR ARAUJO | visible-title fallback.

alter table public.portfolio_sections
  add column if not exists browser_title text not null default '';

alter table public.portfolio_projects
  add column if not exists browser_title text not null default '';
