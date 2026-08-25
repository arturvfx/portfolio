-- Optional editorial hero for each project section.
-- Featured Work starts enabled; every other existing or new section remains opt-in.

alter table public.portfolio_sections
  add column if not exists hero_enabled boolean not null default false;

update public.portfolio_sections
set hero_enabled = true
where id = 'featured-work';
