-- Per-section background controls.
-- Existing sections keep the current shared gallery video by default.

alter table public.portfolio_sections
  add column if not exists background_enabled boolean not null default true,
  add column if not exists background_source text not null default 'default',
  add column if not exists background_video text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'portfolio_sections_background_source_check'
      and conrelid = 'public.portfolio_sections'::regclass
  ) then
    alter table public.portfolio_sections
      add constraint portfolio_sections_background_source_check
      check (background_source in ('default', 'homepage', 'custom'));
  end if;
end
$$;
