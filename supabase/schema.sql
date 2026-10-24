-- =====================================================================
-- CRM Komisji ds. Współprac Zewnętrznych – Samorząd Studentów UWr
-- Schemat bazy dla Supabase (Postgres). Uruchom raz w SQL Editor.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- konfiguracja ----------
create table if not exists public.app_config (
  id int primary key default 1 check (id = 1),
  allowed_domains text[] not null default array['uwr.edu.pl'],
  org_name text not null default 'Komisja ds. Współprac Zewnętrznych',
  allowed_emails text[] not null default '{}'   -- pojedyncze adresy spoza domen (np. konto admina)
);
insert into public.app_config (id) values (1) on conflict do nothing;

-- ---------- ludzie ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  fn text not null default '',              -- funkcja w komisji
  phone text not null default '',
  instagram text not null default '',       -- konto, z którego osoba pisze
  signature text not null default '',
  outlook_kind text not null default 'web' check (outlook_kind in ('web','live','app')),
  role text not null default 'member' check (role in ('admin','leader','member')),
  status text not null default 'pending' check (status in ('pending','active','blocked')),
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sectors text[] not null default '{}',     -- całe sektory (zakładki arkusza)
  categories text[] not null default '{}',  -- pojedyncze kategorie
  leader_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (team_id, user_id)
);

-- ---------- firmy ----------
create table if not exists public.firms (
  id text primary key,
  name text not null,
  sector text not null default 'Do uzupełnienia',
  category text not null default '',
  reach text not null default '',           -- 'Wrocław' / 'Polska' / ''
  phone text not null default '',
  email text not null default '',
  instagram text not null default '',
  facebook text not null default '',
  tiktok text not null default '',
  linkedin text not null default '',
  website text not null default '',
  address text not null default '',
  collected_by text not null default '',
  notes text not null default '',
  last_mail text not null default '',       -- z arkusza (Mail nr 1-3)
  status text not null default '' check (status in ('','G','Y','R')),
  stage text not null default 'nowa' check (stage in ('nowa','kontakt','wyslano','followup','odpowiedz','rozmowy','wspolpraca','pozniej','odmowa')),
  owner_id uuid references public.profiles(id) on delete set null,  -- kto prowadzi kontakt z całą firmą
  last_contact date,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
create index if not exists firms_sector_idx on public.firms(sector);
create index if not exists firms_owner_idx on public.firms(owner_id);

-- ---------- kampanie ----------
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  goal text not null default '',
  steps jsonb not null default '[]',        -- [{day, channels:[...], label, subject, body, dm, script}]
  status text not null default 'active' check (status in ('active','paused','done')),
  team_id uuid references public.teams(id) on delete set null,
  start_date date not null default current_date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_targets (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  firm_id text not null references public.firms(id) on delete cascade,
  assignee uuid references public.profiles(id) on delete set null,
  step int not null default 0,
  due date not null default current_date,
  state text not null default 'active' check (state in ('active','waiting','replied','stopped')),
  last date,
  outcome text,
  added_at timestamptz not null default now(),
  primary key (campaign_id, firm_id)
);
create index if not exists targets_assignee_idx on public.campaign_targets(assignee, state, due);

-- ---------- historia kontaktu ----------
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  firm_id text not null references public.firms(id) on delete cascade,
  type text not null,                        -- contact | reply | note | phone | meeting | visit | stage | edit | campaign
  channels text[] not null default '{}',     -- email, ig, fb, tiktok, linkedin, phone, visit
  campaign_id uuid references public.campaigns(id) on delete set null,
  step int,
  subject text,
  summary text,
  outcome text,
  to_stage text,
  public_note text,
  by uuid references public.profiles(id) on delete set null default auth.uid(),
  at timestamptz not null default now()
);
create index if not exists activities_firm_idx on public.activities(firm_id, at desc);
create index if not exists activities_at_idx on public.activities(at desc);

-- treść odpowiedzi firmy – widzi ją wyłącznie osoba, która ją zapisała
create table if not exists public.reply_contents (
  activity_id uuid primary key references public.activities(id) on delete cascade,
  author uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null default ''
);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null default 'email',
  subject text not null default '',
  body text not null default '',
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------- funkcje pomocnicze ----------
create or replace function public.is_active() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'active');
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'active' and role = 'admin');
$$;
create or replace function public.is_lead() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'active' and role in ('admin','leader'));
$$;
create or replace function public.leads_team(t uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from teams where id = t and leader_id = auth.uid());
$$;

-- nowe konto: tylko domena uczelniana (blokada przed utworzeniem konta)
create or replace function public.handle_new_user_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare dom text := lower(split_part(coalesce(new.email,''), '@', 2)); ok boolean;
begin
  select exists (select 1 from app_config c, unnest(c.allowed_domains) d where dom = lower(d) or dom like '%.' || lower(d))
      or exists (select 1 from app_config c, unnest(c.allowed_emails) e where lower(e) = lower(new.email)) into ok;
  if not ok then
    raise exception 'Logowanie tylko adresem uczelnianym (%).', (select array_to_string(allowed_domains, ', ') from app_config);
  end if;
  return new;
end $$;
-- po utworzeniu konta: profil. Pierwsze konto w systemie zostaje aktywnym adminem.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare first boolean;
begin
  select not exists (select 1 from profiles) into first;
  insert into profiles (id, email, role, status)
  values (new.id, lower(new.email), case when first then 'admin' else 'member' end, case when first then 'active' else 'pending' end)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_guard on auth.users;
create trigger on_auth_user_guard before insert on auth.users for each row execute function public.handle_new_user_guard();
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- zwykły użytkownik nie może sam zmienić sobie roli, statusu ani maila
create or replace function public.protect_profile() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and auth.uid() is not null then
    new.role := old.role; new.status := old.status; new.email := old.email;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles for each row execute function public.protect_profile();

-- znacznik zmiany firmy
create or replace function public.touch_firm() returns trigger language plpgsql as $$
begin new.updated_at := now(); new.updated_by := coalesce(auth.uid(), new.updated_by); return new; end $$;
drop trigger if exists touch_firm on public.firms;
create trigger touch_firm before update on public.firms for each row execute function public.touch_firm();

-- etap → status (kolumna Status z arkusza)
create or replace function public.stage_status() returns trigger language plpgsql as $$
begin
  if new.stage = 'wspolpraca' then new.status := 'G';
  elsif new.stage = 'pozniej' then new.status := 'Y';
  elsif new.stage = 'odmowa' then new.status := 'R';
  end if;
  return new;
end $$;
drop trigger if exists stage_status on public.firms;
create trigger stage_status before insert or update of stage on public.firms for each row execute function public.stage_status();

-- ---------- RLS ----------
alter table public.app_config enable row level security;
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.firms enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_targets enable row level security;
alter table public.activities enable row level security;
alter table public.reply_contents enable row level security;
alter table public.templates enable row level security;

drop policy if exists cfg_read on public.app_config;
create policy cfg_read on public.app_config for select using (true);
drop policy if exists cfg_admin on public.app_config;
create policy cfg_admin on public.app_config for update using (public.is_admin());

drop policy if exists prof_read on public.profiles;
create policy prof_read on public.profiles for select using (id = auth.uid() or public.is_active());
drop policy if exists prof_self on public.profiles;
create policy prof_self on public.profiles for update using (id = auth.uid() or public.is_admin());
drop policy if exists prof_admin_del on public.profiles;
create policy prof_admin_del on public.profiles for delete using (public.is_admin());

drop policy if exists teams_read on public.teams;
create policy teams_read on public.teams for select using (public.is_active());
drop policy if exists teams_admin on public.teams;
create policy teams_admin on public.teams for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists teams_leader_upd on public.teams;
create policy teams_leader_upd on public.teams for update using (leader_id = auth.uid()) with check (leader_id = auth.uid());

drop policy if exists tm_read on public.team_members;
create policy tm_read on public.team_members for select using (public.is_active());
drop policy if exists tm_write on public.team_members;
create policy tm_write on public.team_members for all using (public.leads_team(team_id)) with check (public.leads_team(team_id));

drop policy if exists firms_read on public.firms;
create policy firms_read on public.firms for select using (public.is_active());
drop policy if exists firms_ins on public.firms;
create policy firms_ins on public.firms for insert with check (public.is_active());
drop policy if exists firms_upd on public.firms;
create policy firms_upd on public.firms for update using (public.is_active()) with check (public.is_active());
drop policy if exists firms_del on public.firms;
create policy firms_del on public.firms for delete using (public.is_admin());

drop policy if exists camp_read on public.campaigns;
create policy camp_read on public.campaigns for select using (public.is_active());
drop policy if exists camp_ins on public.campaigns;
create policy camp_ins on public.campaigns for insert with check (public.is_lead());
drop policy if exists camp_upd on public.campaigns;
create policy camp_upd on public.campaigns for update using (public.is_admin() or created_by = auth.uid() or public.leads_team(team_id));
drop policy if exists camp_del on public.campaigns;
create policy camp_del on public.campaigns for delete using (public.is_admin() or created_by = auth.uid());

drop policy if exists tg_read on public.campaign_targets;
create policy tg_read on public.campaign_targets for select using (public.is_active());
drop policy if exists tg_ins on public.campaign_targets;
create policy tg_ins on public.campaign_targets for insert with check (public.is_active() and (assignee = auth.uid() or public.is_lead()));
drop policy if exists tg_upd on public.campaign_targets;
create policy tg_upd on public.campaign_targets for update using (public.is_active() and (assignee = auth.uid() or public.is_lead()));
drop policy if exists tg_del on public.campaign_targets;
create policy tg_del on public.campaign_targets for delete using (public.is_lead());

drop policy if exists act_read on public.activities;
create policy act_read on public.activities for select using (public.is_active());
drop policy if exists act_ins on public.activities;
create policy act_ins on public.activities for insert with check (public.is_active() and by = auth.uid());
drop policy if exists act_own on public.activities;
create policy act_own on public.activities for delete using (by = auth.uid() or public.is_admin());

drop policy if exists rc_own on public.reply_contents;
create policy rc_own on public.reply_contents for all using (author = auth.uid()) with check (author = auth.uid());

drop policy if exists tpl_read on public.templates;
create policy tpl_read on public.templates for select using (public.is_active());
drop policy if exists tpl_ins on public.templates;
create policy tpl_ins on public.templates for insert with check (public.is_active());
drop policy if exists tpl_upd on public.templates;
create policy tpl_upd on public.templates for update using (created_by = auth.uid() or public.is_admin());
drop policy if exists tpl_del on public.templates;
create policy tpl_del on public.templates for delete using (created_by = auth.uid() or public.is_admin());

-- ---------- realtime (zmiany widoczne od razu u wszystkich) ----------
do $$
declare t text;
begin
  foreach t in array array['profiles','teams','team_members','firms','campaigns','campaign_targets','activities','templates'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; when undefined_object then null;
    end;
  end loop;
end $$;

-- ---------- uprawnienia ról API ----------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;
grant select on public.app_config to anon;
grant execute on all functions in schema public to authenticated;
