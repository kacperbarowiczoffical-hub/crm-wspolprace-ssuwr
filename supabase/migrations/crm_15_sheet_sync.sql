-- Synchronizacja z arkuszem Google (skrypt Apps Script w arkuszu „baza firm”).
-- Skrypt zna tylko klucz synchronizacji (nie klucz serwisowy) i może wyłącznie
-- czytać firmy oraz aktualizować/dodawać firmy przez dwie funkcje poniżej.

create table if not exists public.sheet_sync_cfg (
  id int primary key default 1 check (id = 1),
  secret text not null,
  last_run timestamptz,
  last_info jsonb
);
alter table public.sheet_sync_cfg enable row level security;
insert into public.sheet_sync_cfg (id, secret)
values (1, encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (id) do nothing;

-- firmy, które były już kiedyś w arkuszu (żeby nie dopisywać z powrotem usuniętych wierszy)
create table if not exists public.sheet_links (
  firm_id text primary key references public.firms(id) on delete cascade,
  linked_at timestamptz not null default now()
);
alter table public.sheet_links enable row level security;
drop policy if exists sl_read on public.sheet_links;
create policy sl_read on public.sheet_links for select using (public.is_active());

create or replace function public.sheet_check(p text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p is null or not exists (select 1 from sheet_sync_cfg where id = 1 and secret = p) then
    raise exception 'Nieprawidłowy klucz synchronizacji';
  end if;
end $$;

create or replace function public.sheet_pull(p_secret text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform sheet_check(p_secret);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', f.id, 'name', f.name, 'sector', f.sector, 'category', f.category, 'reach', f.reach,
      'phone', f.phone, 'email', f.email, 'instagram', f.instagram, 'facebook', f.facebook,
      'tiktok', f.tiktok, 'linkedin', f.linkedin, 'website', f.website, 'address', f.address,
      'collected_by', f.collected_by, 'notes', f.notes, 'status', f.status, 'stage', f.stage,
      'deleted', f.deleted, 'updated_at', f.updated_at, 'linked', l.firm_id is not null))
    from firms f left join sheet_links l on l.firm_id = f.id), '[]'::jsonb);
end $$;

create or replace function public.sheet_push(p_secret text, p_updates jsonb default '[]', p_inserts jsonb default '[]', p_links text[] default '{}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u jsonb; f jsonb; fid text; base text; k int; n int; cnt int := 0; ins jsonb := '[]'; st text;
begin
  perform sheet_check(p_secret);

  for u in select * from jsonb_array_elements(coalesce(p_updates, '[]')) loop
    f := u->'f';
    st := case when f ? 'status' and coalesce(f->>'status','') in ('','G','Y','R') then coalesce(f->>'status','') end;
    update firms set
      name         = case when f ? 'name' and btrim(coalesce(f->>'name','')) <> '' then f->>'name' else name end,
      sector       = case when f ? 'sector' and coalesce(f->>'sector','') <> '' then f->>'sector' else sector end,
      category     = case when f ? 'category' then coalesce(f->>'category','') else category end,
      reach        = case when f ? 'reach' then coalesce(f->>'reach','') else reach end,
      phone        = case when f ? 'phone' then coalesce(f->>'phone','') else phone end,
      email        = case when f ? 'email' then coalesce(f->>'email','') else email end,
      instagram    = case when f ? 'instagram' then coalesce(f->>'instagram','') else instagram end,
      facebook     = case when f ? 'facebook' then coalesce(f->>'facebook','') else facebook end,
      tiktok       = case when f ? 'tiktok' then coalesce(f->>'tiktok','') else tiktok end,
      linkedin     = case when f ? 'linkedin' then coalesce(f->>'linkedin','') else linkedin end,
      website      = case when f ? 'website' then coalesce(f->>'website','') else website end,
      address      = case when f ? 'address' then coalesce(f->>'address','') else address end,
      collected_by = case when f ? 'collected_by' then coalesce(f->>'collected_by','') else collected_by end,
      notes        = case when f ? 'notes' then coalesce(f->>'notes','') else notes end,
      last_mail    = case when f ? 'last_mail' then coalesce(f->>'last_mail','') else last_mail end,
      status       = coalesce(st, status),
      stage        = case when st is null then stage
                          when st = 'G' then 'wspolpraca' when st = 'Y' then 'pozniej' when st = 'R' then 'odmowa'
                          when stage in ('wspolpraca','pozniej','odmowa') then 'nowa' else stage end
    where id = u->>'id' and not deleted;
    get diagnostics n = row_count; cnt := cnt + n;
  end loop;

  for u in select * from jsonb_array_elements(coalesce(p_inserts, '[]')) loop
    f := u->'f';
    if btrim(coalesce(f->>'name','')) = '' then continue; end if;
    base := coalesce(nullif(u->>'id',''), 'firma'); fid := base; k := 2;
    while exists (select 1 from firms where id = fid) loop fid := base || '-' || k; k := k + 1; end loop;
    st := case when coalesce(f->>'status','') in ('G','Y','R') then f->>'status' else '' end;
    insert into firms (id, name, sector, category, reach, phone, email, instagram, facebook, tiktok, linkedin,
                       website, address, collected_by, notes, last_mail, status, stage)
    values (fid, f->>'name', coalesce(nullif(f->>'sector',''), 'Do uzupełnienia'), coalesce(f->>'category',''),
            coalesce(f->>'reach',''), coalesce(f->>'phone',''), coalesce(f->>'email',''), coalesce(f->>'instagram',''),
            coalesce(f->>'facebook',''), coalesce(f->>'tiktok',''), coalesce(f->>'linkedin',''), coalesce(f->>'website',''),
            coalesce(f->>'address',''), coalesce(f->>'collected_by',''), coalesce(f->>'notes',''), coalesce(f->>'last_mail',''),
            st, case st when 'G' then 'wspolpraca' when 'Y' then 'pozniej' when 'R' then 'odmowa' else 'nowa' end);
    insert into sheet_links (firm_id) values (fid) on conflict do nothing;
    ins := ins || jsonb_build_array(jsonb_build_object('tmp', u->>'tmp', 'id', fid));
  end loop;

  insert into sheet_links (firm_id)
  select x from unnest(coalesce(p_links, '{}')) x where exists (select 1 from firms where id = x)
  on conflict do nothing;

  update sheet_sync_cfg set last_run = now(),
    last_info = jsonb_build_object('updated', cnt, 'inserted', jsonb_array_length(ins)) where id = 1;
  return jsonb_build_object('updated', cnt, 'inserted', ins);
end $$;

revoke all on function public.sheet_check(text) from public, anon, authenticated;
revoke all on function public.sheet_pull(text) from public;
revoke all on function public.sheet_push(text, jsonb, jsonb, text[]) from public;
grant execute on function public.sheet_pull(text) to anon, authenticated;
grant execute on function public.sheet_push(text, jsonb, jsonb, text[]) to anon, authenticated;
