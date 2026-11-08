-- Pula kampanii: każdy aktywny członek może wziąć wolną firmę z aktywnej kampanii (bez ograniczenia do zespołu),
-- a wzięcie firmy ustawia go jako osobę prowadzącą.
create or replace function public.claim_target(p_campaign uuid, p_firm text)
returns boolean language plpgsql security definer set search_path = public as $$
declare c campaigns; n int;
begin
  if not public.is_active() then raise exception 'Brak dostępu.'; end if;
  select * into c from campaigns where id = p_campaign;
  if c.id is null or c.status <> 'active' then raise exception 'Kampania nie jest aktywna.'; end if;
  update campaign_targets set assignee = auth.uid(), due = greatest(due, current_date)
   where campaign_id = p_campaign and firm_id = p_firm and assignee is null;
  get diagnostics n = row_count;
  if n = 0 then return false; end if;
  perform set_config('crm.claim', '1', true);
  update firms set owner_id = auth.uid() where id = p_firm;
  perform set_config('crm.claim', '', true);
  return true;
end $$;

-- Członek (nie lider/admin) nie może usuwać firm ani przypisywać ich innym osobom – tylko wziąć wolną na siebie albo oddać swoją.
create or replace function public.protect_firm()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_lead() then
    if new.deleted is distinct from old.deleted then
      raise exception 'Tylko lider lub administrator może usuwać firmy.';
    end if;
    if new.owner_id is distinct from old.owner_id and coalesce(current_setting('crm.claim', true), '') <> '1'
       and not ((old.owner_id is null and new.owner_id = auth.uid()) or (old.owner_id = auth.uid() and new.owner_id is null)) then
      raise exception 'Nie możesz przypisać firmy innej osobie.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists firms_protect on public.firms;
create trigger firms_protect before update on public.firms for each row execute function public.protect_firm();

-- Lider może edytować swój zespół, ale nie może zmienić lidera (to robi administrator).
create or replace function public.protect_team()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() and new.leader_id is distinct from old.leader_id then
    raise exception 'Lidera zespołu zmienia administrator.';
  end if;
  return new;
end $$;
drop trigger if exists teams_protect on public.teams;
create trigger teams_protect before update on public.teams for each row execute function public.protect_team();

revoke all on function public.protect_firm() from public, anon, authenticated;
revoke all on function public.protect_team() from public, anon, authenticated;
