-- Public section URLs are editable without changing relational section IDs.
-- Previous slugs remain resolvable by the client so existing links keep working.

alter table public.portfolio_sections
  add column if not exists slug text,
  add column if not exists previous_slugs text[] not null default '{}';

update public.portfolio_sections
set slug = id
where slug is null or btrim(slug) = '';

alter table public.portfolio_sections
  alter column slug set not null;

create unique index if not exists portfolio_sections_slug_unique_idx
  on public.portfolio_sections (slug);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'portfolio_sections_slug_format_check'
      and conrelid = 'public.portfolio_sections'::regclass
  ) then
    alter table public.portfolio_sections
      add constraint portfolio_sections_slug_format_check
      check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
  end if;
end $$;

notify pgrst, 'reload schema';
