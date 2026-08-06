-- Portfolio VFX — initial Supabase schema
-- Run this migration in the Supabase SQL editor after creating the project.

create table if not exists public.portfolio_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.portfolio_sections (
  id text primary key,
  title text not null,
  description text not null default '',
  published boolean not null default false,
  display_order integer not null default 1 check (display_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portfolio_projects (
  id text primary key,
  slug text not null unique,
  title text not null,
  client text not null default '',
  category text not null default '',
  year text not null default '',
  services text[] not null default '{}',
  project_summary text not null default '',
  contribution text not null default '',
  director text not null default '',
  production_company text not null default '',
  watch_now_enabled boolean not null default false,
  watch_now_url text not null default '',
  cover_image text not null default '',
  preview_video text not null default '',
  youtube_url text not null default '',
  project_stills jsonb not null default '[]'::jsonb
    check (
      case when jsonb_typeof(project_stills) = 'array'
        then jsonb_array_length(project_stills) <= 3
        else false
      end
    ),
  section_id text not null references public.portfolio_sections(id)
    on update cascade on delete restrict,
  size text not null default '16-9' check (size in ('16-9', '9-16', '4-3')),
  published boolean not null default false,
  display_order integer not null default 1 check (display_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portfolio_sections_public_order_idx
  on public.portfolio_sections (published, display_order);

create index if not exists portfolio_projects_section_order_idx
  on public.portfolio_projects (section_id, published, display_order);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_portfolio_sections_updated_at on public.portfolio_sections;
create trigger set_portfolio_sections_updated_at
before update on public.portfolio_sections
for each row execute function public.set_updated_at();

drop trigger if exists set_portfolio_projects_updated_at on public.portfolio_projects;
create trigger set_portfolio_projects_updated_at
before update on public.portfolio_projects
for each row execute function public.set_updated_at();

alter table public.portfolio_admins enable row level security;
alter table public.portfolio_sections enable row level security;
alter table public.portfolio_projects enable row level security;

-- Public visitors can read only published content.
create policy "Published sections are public"
on public.portfolio_sections for select
to anon, authenticated
using (published = true);

create policy "Published projects are public"
on public.portfolio_projects for select
to anon, authenticated
using (
  published = true
  and exists (
    select 1 from public.portfolio_sections section
    where section.id = section_id and section.published = true
  )
);

-- Portfolio admins can read drafts and manage all portfolio content.
create policy "Admins can read sections"
on public.portfolio_sections for select
to authenticated
using (exists (select 1 from public.portfolio_admins admin where admin.user_id = (select auth.uid())));

create policy "Admins can manage sections"
on public.portfolio_sections for all
to authenticated
using (exists (select 1 from public.portfolio_admins admin where admin.user_id = (select auth.uid())))
with check (exists (select 1 from public.portfolio_admins admin where admin.user_id = (select auth.uid())));

create policy "Admins can read projects"
on public.portfolio_projects for select
to authenticated
using (exists (select 1 from public.portfolio_admins admin where admin.user_id = (select auth.uid())));

create policy "Admins can manage projects"
on public.portfolio_projects for all
to authenticated
using (exists (select 1 from public.portfolio_admins admin where admin.user_id = (select auth.uid())))
with check (exists (select 1 from public.portfolio_admins admin where admin.user_id = (select auth.uid())));

-- Users may verify only their own admin membership.
create policy "Users can read own admin membership"
on public.portfolio_admins for select
to authenticated
using (user_id = (select auth.uid()));

-- Public media bucket. Only registered portfolio admins may write to it.
insert into storage.buckets (id, name, public)
values ('portfolio-media', 'portfolio-media', true)
on conflict (id) do update set public = excluded.public;

create policy "Portfolio media is public"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'portfolio-media');

create policy "Admins can upload portfolio media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'portfolio-media'
  and exists (select 1 from public.portfolio_admins admin where admin.user_id = (select auth.uid()))
);

create policy "Admins can update portfolio media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'portfolio-media'
  and exists (select 1 from public.portfolio_admins admin where admin.user_id = (select auth.uid()))
)
with check (
  bucket_id = 'portfolio-media'
  and exists (select 1 from public.portfolio_admins admin where admin.user_id = (select auth.uid()))
);

create policy "Admins can delete portfolio media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'portfolio-media'
  and exists (select 1 from public.portfolio_admins admin where admin.user_id = (select auth.uid()))
);

-- After creating your Auth user, run once with the user's UUID:
-- insert into public.portfolio_admins (user_id) values ('YOUR_AUTH_USER_UUID');
