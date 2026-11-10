-- Reset przydziałów w kampanii: zdejmuje osoby ze wszystkich firm kampanii (wracają do puli „Do wzięcia”),
-- opcjonalnie zeruje postęp na ścieżce i zdejmuje „Prowadzi” z firm na etapie „nowa” bez historii kontaktu.
-- Uprawnienia: tylko administrator główny.
-- p_apply = false → tylko podgląd liczb, nic nie zmienia.
create or replace function public.reset_campaign_assignments(
  p_campaign uuid,
  p_reset_progress boolean default false,
  p_clear_owners boolean default false,
  p_apply boolean default true
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c campaigns;
  v_total int; v_assigned int; v_started int; v_owners int;
  n_unassigned int := 0; n_progress int := 0; n_owners int := 0;
begin
  if not public.is_active() then raise exception 'Brak dostępu.'; end if;
  select * into c from campaigns where id = p_campaign;
  if c.id is null then raise exception 'Nie znaleziono kampanii.'; end if;
  if not public.is_admin() then
    raise exception 'Przydziały w kampanii może resetować tylko administrator.';
  end if;

  select count(*), count(*) filter (where assignee is not null),
         count(*) filter (where coalesce(step,0) > 0 or state <> 'active' or last is not null or outcome is not null)
    into v_total, v_assigned, v_started
    from campaign_targets where campaign_id = p_campaign;

  select count(*) into v_owners
    from firms f
   where f.owner_id is not null and f.stage = 'nowa'
     and f.id in (select firm_id from campaign_targets where campaign_id = p_campaign)
     and not exists (select 1 from activities a where a.firm_id = f.id);

  if p_apply then
    update campaign_targets set assignee = null
     where campaign_id = p_campaign and assignee is not null;
    get diagnostics n_unassigned = row_count;

    if p_reset_progress then
      update campaign_targets set step = 0, state = 'active', last = null, outcome = null, due = current_date
       where campaign_id = p_campaign;
      get diagnostics n_progress = row_count;
    end if;

    if p_clear_owners then
      perform set_config('crm.claim', '1', true);
      update firms f set owner_id = null
       where f.owner_id is not null and f.stage = 'nowa'
         and f.id in (select firm_id from campaign_targets where campaign_id = p_campaign)
         and not exists (select 1 from activities a where a.firm_id = f.id);
      get diagnostics n_owners = row_count;
      perform set_config('crm.claim', '', true);
    end if;
  end if;

  return jsonb_build_object(
    'total', v_total,
    'assigned_before', v_assigned,
    'pool_before', v_total - v_assigned,
    'started_before', v_started,
    'owners_eligible', v_owners,
    'unassigned', n_unassigned,
    'progress_reset', n_progress,
    'owners_cleared', n_owners,
    'assigned_after', (select count(*) from campaign_targets where campaign_id = p_campaign and assignee is not null),
    'pool_after', (select count(*) from campaign_targets where campaign_id = p_campaign and assignee is null),
    'applied', p_apply
  );
end $$;

revoke all on function public.reset_campaign_assignments(uuid, boolean, boolean, boolean) from public, anon;
grant execute on function public.reset_campaign_assignments(uuid, boolean, boolean, boolean) to authenticated;
