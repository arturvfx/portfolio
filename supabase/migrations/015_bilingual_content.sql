-- PT-BR remains in the existing canonical columns. Optional English editorial
-- content is stored in a compact JSON object and falls back to PT-BR.

alter table public.portfolio_projects
  add column if not exists translations jsonb not null default '{"en": {}}'::jsonb
    check (jsonb_typeof(translations) = 'object');

alter table public.portfolio_sections
  add column if not exists translations jsonb not null default '{"en": {}}'::jsonb
    check (jsonb_typeof(translations) = 'object');

update public.portfolio_site_settings
set settings = jsonb_set(
  settings,
  '{translations}',
  case
    when jsonb_typeof(settings->'translations') = 'object' then settings->'translations'
    else '{"en": {}}'::jsonb
  end,
  true
)
where id = 'global';
