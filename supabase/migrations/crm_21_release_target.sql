-- Oddanie firmy z kampanii z powrotem do puli „Do wzięcia”.
-- Członek może oddać tylko firmę przypisaną do siebie; lider i administrator – każdą.
-- Jeśli osoba oddająca była też „prowadzącym” firmę, firma zostaje bez opiekuna.
create or replace function public.release_target(p_campaign uuid, p_firm text)
returns boolean language plpgsql security definer set search_path = public as $$
declare who uuid;
begin
  if not public.is_active() then raise exception 'Brak dostępu.'; end if;
  select assignee into who from campaign_targets where campaign_id = p_campaign and firm_id = p_firm;
  if who is null then return false; end if;
  if who <> auth.uid() and not public.is_lead() then raise exception 'Możesz oddać do puli tylko swoją firmę.'; end if;
  update campaign_targets set assignee = null where campaign_id = p_campaign and firm_id = p_firm;
  perform set_config('crm.claim', '1', true);
  update firms set owner_id = null where id = p_firm and owner_id = who;
  perform set_config('crm.claim', '', true);
  return true;
end $$;

revoke all on function public.release_target(uuid, text) from public, anon;
grant execute on function public.release_target(uuid, text) to authenticated;
