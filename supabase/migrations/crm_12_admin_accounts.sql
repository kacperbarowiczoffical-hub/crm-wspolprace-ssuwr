-- Konta zakładane przez administratora (hasło startowe) – bez wysyłania maili.
create or replace function public.admin_add_user(p_email text, p_password text, p_name text default '', p_role text default 'member')
returns uuid language plpgsql security definer set search_path = public, extensions, auth as $$
declare e text := lower(trim(p_email)); uid uuid;
begin
  if not public.is_admin() then raise exception 'Tylko administrator może dodawać osoby.'; end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Nieprawidłowy adres e-mail.'; end if;
  if length(coalesce(p_password,'')) < 8 then raise exception 'Hasło musi mieć co najmniej 8 znaków.'; end if;
  if p_role not in ('admin','leader','member') then p_role := 'member'; end if;
  -- admin świadomie dodaje osobę: adres spoza domeny trafia na listę wyjątków
  update app_config set allowed_emails = array_append(coalesce(allowed_emails,'{}'), e)
   where id = 1
     and not exists (select 1 from unnest(allowed_domains) d where split_part(e,'@',2) = lower(d) or split_part(e,'@',2) like '%.' || lower(d))
     and not (e = any(coalesce(allowed_emails,'{}')));
  select id into uid from auth.users where lower(email) = e;
  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, reauthentication_token)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', e, crypt(p_password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
    values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', e, 'email_verified', true), 'email', now(), now(), now());
  else
    update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = uid;
  end if;
  insert into profiles (id, email) values (uid, e) on conflict (id) do nothing;
  update profiles set status = 'active', role = p_role, full_name = case when coalesce(p_name,'') <> '' then p_name else full_name end where id = uid;
  return uid;
end $$;

create or replace function public.admin_set_password(p_user uuid, p_password text)
returns void language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if not public.is_admin() then raise exception 'Tylko administrator może zmieniać hasła.'; end if;
  if length(coalesce(p_password,'')) < 8 then raise exception 'Hasło musi mieć co najmniej 8 znaków.'; end if;
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where id = p_user;
end $$;

revoke all on function public.admin_add_user(text,text,text,text) from public, anon;
revoke all on function public.admin_set_password(uuid,text) from public, anon;
grant execute on function public.admin_add_user(text,text,text,text) to authenticated;
grant execute on function public.admin_set_password(uuid,text) to authenticated;
