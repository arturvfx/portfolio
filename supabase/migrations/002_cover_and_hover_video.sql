-- Portfolio VFX — replace the ambiguous thumbnail/poster model with:
--   cover_image: the still image shown by default
--   preview_video: the optional video played on hover

alter table public.portfolio_projects
  add column if not exists cover_image text not null default '',
  add column if not exists preview_video text not null default '';

-- Preserve existing media before removing the old columns. The dynamic block
-- also makes the migration safe to run again after those columns are gone.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'portfolio_projects'
      and column_name = 'thumbnail'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'portfolio_projects'
      and column_name = 'poster'
  ) then
    execute $migration$
      update public.portfolio_projects
      set
        cover_image = case
          when lower(thumbnail) ~ '\.(avif|gif|jpe?g|png|webp)(\?.*)?$' then thumbnail
          when lower(poster) ~ '\.(avif|gif|jpe?g|png|webp)(\?.*)?$' then poster
          else cover_image
        end,
        preview_video = case
          when lower(thumbnail) ~ '\.(mp4|webm)(\?.*)?$' then thumbnail
          else preview_video
        end
    $migration$;
  end if;
end
$$;

alter table public.portfolio_projects
  drop column if exists thumbnail,
  drop column if exists poster;
