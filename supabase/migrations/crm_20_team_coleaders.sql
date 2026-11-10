-- Wielu liderów w zespole.
--  * teams.leader_id = lider główny (zmienia tylko administrator, jak dotąd).
--  * team_members.is_leader = współlider: ma te same uprawnienia do zespołu co lider główny.
--  * Lider (główny albo współlider) może nadawać/odbierać status współlidera w swoim zespole.
--    Osoba z rolą "Członek" nadana jako współlider dostaje automatycznie rolę "Lider zespołu".
--  * Zespół, w którym liderem (głównym lub współliderem) jest administrator, edytuje tylko administrator.

alter table public.team_members add column if not exists is_leader boolean not null default false;

-- Czy u jest liderem (głównym lub współliderem) zespołu t.
create or replace function public.is_team_leader(t uuid, u uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from teams where id = t and leader_id = u)
      or exists (select 1 from team_members where team_id = t and user_id = u and is_leader);
$$;

-- Czy wśród liderów zespołu jest administrator.
create or replace function public.team_has_admin_leader(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from teams tt join profiles p on p.id = tt.leader_id where tt.id = t and p.role = 'admin')
      or exists (select 1 from team_members m join profiles p on p.id = m.user_id where m.team_id = t and m.is_leader and p.role = 'admin');
$$;

create or replace function public.leads_team(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or (public.is_lead() and public.is_team_leader(t, auth.uid()) and not public.team_has_admin_leader(t));
$$;

-- Współlider też edytuje zespół (zmianę lidera głównego dalej blokuje trigger teams_protect).
drop policy if exists teams_upd on public.teams;
create policy teams_upd on public.teams for update
  using (public.leads_team(id))
  with check (public.leads_team(id));

-- Nadanie statusu współlidera: awans roli Członek → Lider; nie-admin nie może zrobić współliderem administratora.
create or replace function public.protect_team_member()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text;
begin
  if new.is_leader and (tg_op = 'INSERT' or not old.is_leader) then
    select role into r from profiles where id = new.user_id;
    if r = 'admin' and auth.uid() is not null and not public.is_admin() then
      raise exception 'Administratora jako lidera zespołu może dodać tylko administrator.';
    end if;
    if r = 'member' then
      perform set_config('crm.promote', new.user_id::text, true);
      update profiles set role = 'leader' where id = new.user_id;
      perform set_config('crm.promote', '', true);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists team_members_protect on public.team_members;
create trigger team_members_protect before insert or update on public.team_members
  for each row execute function public.protect_team_member();

-- protect_profile: nie-admin nadal nie zmienia ról, poza awansem Członek → Lider wykonywanym przez protect_team_member.
create or replace function public.protect_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and auth.uid() is not null then
    if not (old.role = 'member' and new.role = 'leader'
            and coalesce(current_setting('crm.promote', true), '') = new.id::text) then
      new.role := old.role;
    end if;
    new.status := old.status; new.email := old.email;
  end if;
  return new;
end $$;

revoke all on function public.protect_profile() from public, anon, authenticated;
revoke all on function public.protect_team_member() from public, anon, authenticated;
