-- Portfolio VFX — protected contact-form inbox.

create table if not exists public.portfolio_contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  email text not null check (char_length(email) between 3 and 254),
  category text not null check (char_length(category) between 1 and 80),
  message text not null check (char_length(message) between 20 and 5000),
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'sent', 'failed')),
  provider_id text not null default '',
  delivery_error text not null default '',
  request_hash text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portfolio_contact_messages_created_idx
  on public.portfolio_contact_messages (created_at desc);

create index if not exists portfolio_contact_messages_rate_limit_idx
  on public.portfolio_contact_messages (request_hash, created_at desc);

drop trigger if exists set_portfolio_contact_messages_updated_at on public.portfolio_contact_messages;
create trigger set_portfolio_contact_messages_updated_at
before update on public.portfolio_contact_messages
for each row execute function public.set_updated_at();

alter table public.portfolio_contact_messages enable row level security;

-- Visitors never write directly to this table. The Edge Function validates
-- requests and inserts with the server-side service role.
drop policy if exists "Admins can read contact messages" on public.portfolio_contact_messages;
create policy "Admins can read contact messages"
on public.portfolio_contact_messages for select
to authenticated
using (exists (select 1 from public.portfolio_admins admin where admin.user_id = (select auth.uid())));

drop policy if exists "Admins can delete contact messages" on public.portfolio_contact_messages;
create policy "Admins can delete contact messages"
on public.portfolio_contact_messages for delete
to authenticated
using (exists (select 1 from public.portfolio_admins admin where admin.user_id = (select auth.uid())));

notify pgrst, 'reload schema';
