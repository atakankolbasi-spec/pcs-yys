      raise exception 'Önce giriş yapılmalı' using errcode = '22023';
    end if;
    update public.visits set exit_at = coalesce(exit_at, now()) where id = v.id;
  elsif p_action = 'giris_geri' then
    if v.exit_at is not null or v.onsite_at is null or v.onsite_at < now() - interval '15 minutes' then
      raise exception 'Giriş artık geri alınamaz; ofise haber verin' using errcode = '22023';
    end if;
    update public.visits set onsite = false, onsite_at = null where id = v.id;
  elsif p_action = 'cikis_geri' then
    if v.exit_at is null or v.exit_at < now() - interval '15 minutes' then
      raise exception 'Çıkış artık geri alınamaz; ofise haber verin' using errcode = '22023';
    end if;
    update public.visits set exit_at = null where id = v.id;
  else
    raise exception 'Geçersiz işlem' using errcode = '22023';
  end if;

  return (select jsonb_build_object('id', x.id, 'onsite', x.onsite, 'onsite_at', x.onsite_at, 'exit_at', x.exit_at)
          from public.visits x where x.id = v.id);
end $$;

revoke all on function public.get_guard_link(), public.rotate_guard_link(), public.get_guard_view_link(), public.rotate_guard_view_link() from public;
revoke all on function public.guard_board(text, date, date), public.guard_mark(text, text, text) from public;
revoke all on function public.guard_account(), public.is_guard_account(), public.list_guard_accounts(),
  public.save_guard_account(text, text, boolean), public.delete_guard_account(text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.get_guard_link(), public.rotate_guard_link(), public.get_guard_view_link(), public.rotate_guard_view_link() from anon';
    execute 'revoke all on function public.guard_account(), public.is_guard_account(), public.list_guard_accounts(), public.save_guard_account(text, text, boolean), public.delete_guard_account(text) from anon';
    execute 'grant execute on function public.guard_board(text, date, date), public.guard_mark(text, text, text) to anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.get_guard_link(), public.rotate_guard_link(), public.get_guard_view_link(), public.rotate_guard_view_link() to authenticated';
    execute 'grant execute on function public.guard_board(text, date, date), public.guard_mark(text, text, text) to authenticated';
    execute 'grant execute on function public.guard_account(), public.is_guard_account(), public.list_guard_accounts(), public.save_guard_account(text, text, boolean), public.delete_guard_account(text) to authenticated';
  end if;
end $$;

-- Güvenlik hesapları tablolara doğrudan erişemez: her tabloya "kısıtlayıcı" kural eklenir. Mevcut kurallar
-- olduğu gibi kalır; bu kural yalnızca listedeki hesapları durdurur (düzenleyici ve diğer hesaplar etkilenmez).
-- Sahibi başka rol olan ya da bir eklentiye ait tablolar atlanır (kural eklenemez; kontrol satırı bildirir).
do $$ declare r record; begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r', 'p')
             and pg_has_role(c.relowner, 'MEMBER')
             and not exists (select 1 from pg_depend d where d.classid = 'pg_class'::regclass and d.objid = c.oid and d.deptype = 'e') loop
    execute format('drop policy if exists guvenlik_hesabi_erisemez on public.%I', r.relname);
    execute format('create policy guvenlik_hesabi_erisemez on public.%I as restrictive for all to authenticated '
                   'using (not (select public.is_guard_account())) with check (not (select public.is_guard_account()))', r.relname);
  end loop;
end $$;

-- İşlem geçmişi: çıkış kayıtları ve "Güvenlik" adı eklenmiş hali
create or replace function public.pcs_log_visit()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  em text;
  ch text[] := '{}';
begin
  select u.email into em from auth.users u where u.id = uid;
  -- güvenlik ekranından yapılan işlemlerde guard_mark "Güvenlik" ya da "Güvenlik · Ad" bırakır
  -- (linkte oturum yoktur; güvenlik hesabında e-posta yerine görevlinin adı yazılır)
  em := coalesce(nullif(current_setting('pcs.actor', true), ''), em);

  if tg_op = 'INSERT' then
    insert into public.visit_log (visit_id, plate, action, detail, actor_id, actor_email)
    values (new.id::text, new.plate, 'insert', jsonb_build_object('date', new.visit_date), uid, em);
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.visit_log (visit_id, plate, action, detail, actor_id, actor_email)
    values (old.id::text, old.plate, 'delete', jsonb_build_object('date', old.visit_date), uid, em);
    return old;
  end if;

  if new.onsite is distinct from old.onsite then
    insert into public.visit_log (visit_id, plate, action, actor_id, actor_email)
    values (new.id::text, new.plate, case when new.onsite then 'onsite_on' else 'onsite_off' end, uid, em);
  elsif new.onsite_at is distinct from old.onsite_at then
    insert into public.visit_log (visit_id, plate, action, detail, actor_id, actor_email)
    values (new.id::text, new.plate, 'onsite_time', jsonb_build_object('at', new.onsite_at), uid, em);
  end if;
  if new.t1 is distinct from old.t1 then
    insert into public.visit_log (visit_id, plate, action, actor_id, actor_email)
    values (new.id::text, new.plate, case when new.t1 then 't1_on' else 't1_off' end, uid, em);
  end if;
  if new.done is distinct from old.done then
    insert into public.visit_log (visit_id, plate, action, actor_id, actor_email)
    values (new.id::text, new.plate, case when new.done then 'done_on' else 'done_off' end, uid, em);
  elsif new.done_at is distinct from old.done_at then
    insert into public.visit_log (visit_id, plate, action, detail, actor_id, actor_email)
    values (new.id::text, new.plate, 'done_time', jsonb_build_object('at', new.done_at), uid, em);
  end if;
  if new.exit_at is distinct from old.exit_at then
    insert into public.visit_log (visit_id, plate, action, detail, actor_id, actor_email)
    values (new.id::text, new.plate,
            case when new.exit_at is null then 'exit_off' when old.exit_at is null then 'exit_on' else 'exit_time' end,
            jsonb_build_object('at', new.exit_at), uid, em);
  end if;
  if new.visit_date is distinct from old.visit_date then
    insert into public.visit_log (visit_id, plate, action, detail, actor_id, actor_email)
    values (new.id::text, new.plate, 'move', jsonb_build_object('from', old.visit_date, 'to', new.visit_date), uid, em);
  end if;

  if new.plate is distinct from old.plate then ch := array_append(ch, 'plate'); end if;
  if new.customer is distinct from old.customer then ch := array_append(ch, 'customer'); end if;
  if new.declaration is distinct from old.declaration then ch := array_append(ch, 'declaration'); end if;
  if new.carrier is distinct from old.carrier then ch := array_append(ch, 'carrier'); end if;
  if new.registration is distinct from old.registration then ch := array_append(ch, 'registration'); end if;
  if new.note is distinct from old.note then ch := array_append(ch, 'note'); end if;
  if new.visit_time is distinct from old.visit_time then ch := array_append(ch, 'visit_time'); end if;
  if array_length(ch, 1) > 0 then
    insert into public.visit_log (visit_id, plate, action, detail, actor_id, actor_email)
    values (new.id::text, new.plate, 'edit', jsonb_build_object('fields', to_jsonb(ch)), uid, em);
  end if;
  return new;
end;
$function$;

-- Sitenin yeni fonksiyonları hemen görmesi için Supabase'in fonksiyon listesini yenile
notify pgrst, 'reload schema';

-- Kontrol: beş satır da "tamam" olmalı. Dosyanın TAMAMINI çalıştırın (editörde bir kısmı seçiliyse yalnızca o
-- kısım çalışır); "güvenlik fonksiyonları" satırı EKSİK derse eski sürüm duruyor demektir. Son satırda
-- "UYARI · RLS kapalı" yazan tabloyu sitedeki anahtarı bilen herkes okuyabilir ve güvenlik hesapları da
-- engellenemez (README bölüm 2); "kural eklenemedi" yazan tablonun sahibi başka bir roldür.
select 'çıkış saati sütunu' as kontrol,
       case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'visits' and column_name = 'exit_at') then 'tamam' else 'EKSİK' end as durum
union all
select 'güvenlik fonksiyonları (güncel sürüm)',
       case when count(*) = 11
             and pg_get_functiondef('public.guard_board(text,date,date)'::regprocedure) like '%guard_account()%'
             and pg_get_functiondef('public.guard_mark(text,text,text)'::regprocedure) like '%guard_account()%'
            then 'tamam' else 'EKSİK · dosyanın tamamını yeniden çalıştırın' end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('get_guard_link', 'rotate_guard_link', 'get_guard_view_link', 'rotate_guard_view_link', 'guard_board', 'guard_mark',
                                              'guard_account', 'is_guard_account', 'list_guard_accounts', 'save_guard_account', 'delete_guard_account')
union all
select 'link anahtarları (güvenlik + izleme)', case when exists (select 1 from information_schema.columns where table_schema = 'private' and table_name = 'guard_link' and column_name = 'view_token') then 'tamam' else 'EKSİK' end
union all
select 'işlem geçmişi (çıkış)', case when pg_get_functiondef('public.pcs_log_visit'::regproc) like '%exit_on%' then 'tamam' else 'EKSİK' end
union all
select 'güvenlik hesapları tablolara erişemez',
       coalesce(nullif(concat_ws(' · ',
         'UYARI · RLS kapalı: ' || string_agg(t.relname, ', ' order by t.relname) filter (where not t.rls),
         'UYARI · kural eklenemedi: ' || string_agg(t.relname, ', ' order by t.relname) filter (where t.rls and not t.kural)), ''), 'tamam')
  from (select c.relname, c.relrowsecurity as rls,
               exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname
                        and p.policyname = 'guvenlik_hesabi_erisemez') as kural
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind in ('r', 'p')
           and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('authenticated', c.oid, 'select'))) t;
