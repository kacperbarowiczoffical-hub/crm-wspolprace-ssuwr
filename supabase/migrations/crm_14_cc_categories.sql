-- DW w mailach + kategorie dodawane w aplikacji
alter table public.app_config add column if not exists cc_email text not null default 'marketingssuwr@gmail.com';
create table if not exists public.categories (
  name text primary key,
  sector text not null default '',
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.categories enable row level security;
create policy cat_read on public.categories for select using (public.is_active());
create policy cat_ins on public.categories for insert with check (public.is_lead());
create policy cat_upd on public.categories for update using (public.is_lead());
create policy cat_del on public.categories for delete using (public.is_admin());
alter publication supabase_realtime add table public.categories;
