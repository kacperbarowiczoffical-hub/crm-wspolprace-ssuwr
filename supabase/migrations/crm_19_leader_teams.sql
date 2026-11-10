-- Uprawnienia do zespołów:
--  * Administrator: tworzy, edytuje i usuwa każdy zespół, zmienia liderów.
--  * Lider (rola 'leader', aktywny): może utworzyć nowy zespół (automatycznie zostaje jego liderem),
--    edytować zespoły, które prowadzi, i dodawać/usuwać w nich ludzi.
--    Nie może edytować zespołów prowadzonych przez administratora ani innych liderów, nie zmienia lidera.
--  * Członek: tylko odczyt.

-- Kto zarządza danym zespołem (używane też w politykach team_members).
create or replace function public.leads_team(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or (public.is_lead() and exists (
            select 1 from teams tt
            join profiles lp on lp.id = tt.leader_id
           where tt.id = t and tt.leader_id = auth.uid() and lp.role <> 'admin'));
$$;

-- INSERT: admin dowolnie, lider tylko z samym sobą jako liderem.
drop policy if exists teams_admin_ins on public.teams;
drop policy if exists teams_ins on public.teams;
create policy teams_ins on public.teams for insert
  with check (public.is_admin() or (public.is_lead() and leader_id = (select auth.uid())));

-- UPDATE: admin każdy zespół, lider tylko prowadzony przez siebie (nie admina).
drop policy if exists teams_upd on public.teams;
drop policy if exists teams_admin on public.teams;
drop policy if exists teams_leader_upd on public.teams;
create policy teams_upd on public.teams for update
  using (public.leads_team(id))
  with check (public.is_admin() or (public.is_lead() and leader_id = (select auth.uid())));

-- DELETE zostaje tylko dla administratora (teams_admin_del bez zmian).

-- Nowy zespół zakładany przez lidera: lider = on sam, niezależnie od tego, co wysłał klient.
create or replace function public.protect_team_ins()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.leader_id := auth.uid();
  end if;
  return new;
end $$;
drop trigger if exists teams_protect_ins on public.teams;
create trigger teams_protect_ins before insert on public.teams for each row execute function public.protect_team_ins();

-- Zmiana lidera nadal tylko przez administratora (bez zmian logiki, odtworzone dla porządku).
create or replace function public.protect_team()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() and new.leader_id is distinct from old.leader_id then
    raise exception 'Lidera zespołu zmienia administrator.';
  end if;
  return new;
end $$;

-- team_members: zapis/usuwanie przez tego, kto zarządza zespołem (admin albo jego lider).
drop policy if exists tm_ins on public.team_members;
create policy tm_ins on public.team_members for insert with check (public.leads_team(team_id));
drop policy if exists tm_del on public.team_members;
create policy tm_del on public.team_members for delete using (public.leads_team(team_id));
drop policy if exists tm_upd on public.team_members;
create policy tm_upd on public.team_members for update using (public.leads_team(team_id)) with check (public.leads_team(team_id));

revoke all on function public.protect_team_ins() from public, anon, authenticated;
revoke all on function public.protect_team() from public, anon, authenticated;
