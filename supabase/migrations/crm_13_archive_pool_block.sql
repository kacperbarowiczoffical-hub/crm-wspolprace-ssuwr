-- Archiwum kampanii
alter table public.campaigns drop constraint if exists campaigns_status_check;
alter table public.campaigns add constraint campaigns_status_check check (status in ('active','paused','done','archived'));

-- Członek bierze firmę z puli kampanii (atomowo – dwie osoby nie wezmą tej samej)
create or replace function public.claim_target(p_campaign uuid, p_firm text)
returns boolean language plpgsql security definer set search_path = public as $$
declare c campaigns; n int;
begin
  if not public.is_active() then raise exception 'Brak dostępu.'; end if;
  select * into c from campaigns where id = p_campaign;
  if c.id is null or c.status <> 'active' then raise exception 'Kampania nie jest aktywna.'; end if;
  if c.team_id is not null and not public.is_lead()
     and not exists (select 1 from team_members where team_id = c.team_id and user_id = auth.uid())
     and not exists (select 1 from teams where id = c.team_id and leader_id = auth.uid()) then
    raise exception 'Ta kampania należy do innego zespołu.';
  end if;
  update campaign_targets set assignee = auth.uid(), due = greatest(due, current_date)
   where campaign_id = p_campaign and firm_id = p_firm and assignee is null;
  get diagnostics n = row_count;
  if n = 0 then return false; end if;
  update firms set owner_id = auth.uid() where id = p_firm and owner_id is null;
  return true;
end $$;
revoke all on function public.claim_target(uuid,text) from public, anon;
grant execute on function public.claim_target(uuid,text) to authenticated;

-- Firma bez odpowiedzi w innej (niezarchiwizowanej) kampanii nie trafia do kolejnej
create or replace function public.block_busy_firm() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from campaign_targets t join campaigns c on c.id = t.campaign_id
             where t.firm_id = new.firm_id and t.campaign_id <> new.campaign_id and c.status <> 'archived' and t.state <> 'replied') then
    return null;
  end if;
  return new;
end $$;
revoke all on function public.block_busy_firm() from public, anon;
drop trigger if exists block_busy_firm on public.campaign_targets;
create trigger block_busy_firm before insert on public.campaign_targets for each row execute function public.block_busy_firm();
