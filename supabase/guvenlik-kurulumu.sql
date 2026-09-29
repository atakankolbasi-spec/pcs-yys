-- Güvenlik linki ve ayrı çıkış saati: veritabanı kurulumu.
--
-- 1) visits tablosuna "exit_at" (tesisten çıkış saati) eklenir. "İşlemler bitti" saati (done_at)
--    ayrı kalır: biri gümrük işlemlerinin bittiği, diğeri aracın kapıdan çıktığı an.
-- 2) Güvenlik görevlilerinin giriş yapmadan açacağı link için gizli bir anahtar tutulur.
--    Linki yalnızca düzenleyiciler görür ve yeniler (Ayarlar > Güvenlik linki).
-- 3) Güvenlik ekranı yalnızca iki şey yapabilir:
--      GİRİŞ  -> araç TESİSTE olur, giriş saati yazılır
--      ÇIKIŞ  -> çıkış saati yazılır
--    Yanlış basılan düğme 15 dakika içinde geri alınabilir. Güvenlik ekranı yalnızca plaka, müşteri,
--    ruhsat (kilo) ve saatleri görür; beyanname ve nakliyeci bilgilerini göremez. Tarih aralığı seçilebilir
--    (en fazla 31 gün, en fazla 2 ay öncesi); işaretleme yalnızca son 7 gün ile yarın arasındaki araçlarda.
-- 4) İşlem geçmişine çıkış kayıtları eklenir; güvenlikten yapılan işlemler "Güvenlik" adıyla görünür.
-- 5) Güvenlik ekranı için ayrı bir "izleme linki": açan kişi ekranı görür ama GİRİŞ / ÇIKIŞ yapamaz.
--    Anahtarı güvenlik linkinden ayrıdır; biri yenilenince diğeri etkilenmez.
-- 6) Güvenlik hesapları: her görevli kendi kullanıcı adı ve şifresiyle girer, yalnızca güvenlik ekranını
--    görür. Listeyi düzenleyiciler Ayarlar > Güvenlik hesapları'ndan yönetir; kullanıcının kendisi
--    Supabase > Authentication > Users'tan açılır. Listedeki hesaplar (kapatılmış olsalar da) tablolara
--    doğrudan erişemez; işlem geçmişinde "Güvenlik · Ad" yazılır.
--
-- Supabase > SQL Editor'de bir kez çalıştırın. Tekrar çalıştırmak zararsızdır.

alter table public.visits add column if not exists exit_at timestamptz;

-- Güvenlik oturum açmadığı için "son değiştiren" (updated_by) boş yazılır; sütun boş bırakılamaz
-- tanımlıysa bu kısıt kaldırılır. Kimin yaptığı işlem geçmişinde "Güvenlik" olarak görünür.
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'visits' and column_name = 'updated_by' and is_nullable = 'NO') then
    alter table public.visits alter column updated_by drop not null;
  end if;
end $$;

create table if not exists private.guard_link (
  id int primary key default 1 check (id = 1),
  token text not null,
  created_at timestamptz not null default now()
);
alter table private.guard_link add column if not exists view_token text;
revoke all on private.guard_link from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on private.guard_link from anon'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'revoke all on private.guard_link from authenticated'; end if;
end $$;

-- Güvenlik hesapları (e-posta küçük harfle). Kapatılan hesap (active = false) güvenlik ekranını açamaz
-- ama tablolara erişim engeli sürer; tamamen kaldırmak için kullanıcı Supabase'den de silinmeli.
create table if not exists private.guard_accounts (
  email text primary key check (email = lower(email) and position('@' in email) > 1),
  name text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
revoke all on private.guard_accounts from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on private.guard_accounts from anon'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'revoke all on private.guard_accounts from authenticated'; end if;
end $$;

-- Giriş yapan kişi güvenlik hesabı mı? Değilse null; öyleyse {"name": ..., "active": ...}
create or replace function public.guard_account() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name', coalesce(nullif(btrim(a.name), ''), split_part(a.email, '@', 1)), 'active', a.active)
  from auth.users u join private.guard_accounts a on a.email = lower(u.email)
  where u.id = auth.uid()
$$;

-- Tablo erişim engeli için (kapatılmış hesaplar da dahil)
create or replace function public.is_guard_account() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users u join private.guard_accounts a on a.email = lower(u.email) where u.id = auth.uid())
$$;

-- Düzenleyici: güvenlik hesaplarını listele / ekle-güncelle / sil
create or replace function public.list_guard_accounts() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not coalesce((select private.is_editor()), false) then
    raise exception 'Bu işlem için düzenleyici yetkisi gerekli' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('email', a.email, 'name', a.name, 'active', a.active, 'created_at', a.created_at,
                                        'has_user', u.id is not null, 'last_sign_in_at', u.last_sign_in_at)
                     order by a.active desc, a.name, a.email)
    from private.guard_accounts a left join auth.users u on lower(u.email) = a.email
  ), '[]'::jsonb);
end $$;

create or replace function public.save_guard_account(p_email text, p_name text, p_active boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare e text := lower(btrim(coalesce(p_email, '')));
begin
  if not coalesce((select private.is_editor()), false) then
    raise exception 'Bu işlem için düzenleyici yetkisi gerekli' using errcode = '42501';
  end if;
  if e !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'Geçerli bir kullanıcı adı ya da e-posta yazın' using errcode = '22023';
  end if;
  if e = (select lower(u.email) from auth.users u where u.id = auth.uid()) then
    raise exception 'Kendi hesabınızı güvenlik hesabı yapamazsınız' using errcode = '22023';
  end if;
  insert into private.guard_accounts (email, name, active) values (e, left(btrim(coalesce(p_name, '')), 60), coalesce(p_active, true))
  on conflict (email) do update set name = excluded.name, active = excluded.active;
  return (select jsonb_build_object('email', a.email, 'name', a.name, 'active', a.active) from private.guard_accounts a where a.email = e);
end $$;

-- Supabase'de kullanıcısı duran hesap silinemez (silinirse o kullanıcı tablolara erişebilir); önce kapatılır.
create or replace function public.delete_guard_account(p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare e text := lower(btrim(coalesce(p_email, '')));
begin
  if not coalesce((select private.is_editor()), false) then
    raise exception 'Bu işlem için düzenleyici yetkisi gerekli' using errcode = '42501';
  end if;
  if exists (select 1 from auth.users u where lower(u.email) = e) then
    raise exception 'Bu kullanıcı Supabase''de duruyor. Önce Authentication > Users''tan silin; o zamana kadar hesabı kapalı tutun.' using errcode = '22023';
  end if;
  delete from private.guard_accounts where email = e;
end $$;

-- Link anahtarını göster (yoksa oluştur) / yenile: yalnızca düzenleyici
create or replace function public.get_guard_link() returns text
language plpgsql security definer set search_path = '' as $$
declare t text;
begin
  if not coalesce((select private.is_editor()), false) then
    raise exception 'Bu işlem için düzenleyici yetkisi gerekli' using errcode = '42501';
  end if;
  select g.token into t from private.guard_link g where g.id = 1;
  if t is null then
    insert into private.guard_link (id, token) values (1, replace(gen_random_uuid()::text, '-', ''))
    on conflict (id) do nothing;
    select g.token into t from private.guard_link g where g.id = 1;
  end if;
  return t;
end $$;

create or replace function public.rotate_guard_link() returns text
language plpgsql security definer set search_path = '' as $$
declare t text := replace(gen_random_uuid()::text, '-', '');
begin
  if not coalesce((select private.is_editor()), false) then
    raise exception 'Bu işlem için düzenleyici yetkisi gerekli' using errcode = '42501';
  end if;
  insert into private.guard_link (id, token, created_at) values (1, t, now())
  on conflict (id) do update set token = excluded.token, created_at = excluded.created_at;
  return t;
end $$;

-- İzleme linkinin anahtarını göster (yoksa oluştur) / yenile: yalnızca düzenleyici
create or replace function public.get_guard_view_link() returns text
language plpgsql security definer set search_path = '' as $$
declare t text;
begin
  if not coalesce((select private.is_editor()), false) then
    raise exception 'Bu işlem için düzenleyici yetkisi gerekli' using errcode = '42501';
  end if;
  insert into private.guard_link (id, token) values (1, replace(gen_random_uuid()::text, '-', ''))
  on conflict (id) do nothing;
  update private.guard_link set view_token = replace(gen_random_uuid()::text, '-', '')
  where id = 1 and view_token is null;
  select g.view_token into t from private.guard_link g where g.id = 1;
  return t;
end $$;

create or replace function public.rotate_guard_view_link() returns text
language plpgsql security definer set search_path = '' as $$
declare t text := replace(gen_random_uuid()::text, '-', '');
begin
  if not coalesce((select private.is_editor()), false) then
    raise exception 'Bu işlem için düzenleyici yetkisi gerekli' using errcode = '42501';
  end if;
  insert into private.guard_link (id, token, view_token) values (1, replace(gen_random_uuid()::text, '-', ''), t)
  on conflict (id) do update set view_token = excluded.view_token;
  return t;
end $$;

-- Güvenlik ekranının listesi: seçilen tarih aralığının araçları (varsayılan bugün) + aralık bugünü
-- kapsıyorsa son 7 günden girip henüz çıkmamış olanlar + önceki günlerden gelip bu aralıkta çıkanlar
-- ("Çıkanlar"da görünsün, paylaşılabilsin). En fazla 31 günlük aralık, en fazla 2 ay öncesi.
-- Güvenlik linki, izleme linki ve açık güvenlik hesapları listeyi görür; "can_mark" izleme linkinde false'tur.
drop function if exists public.guard_board(text);
create or replace function public.guard_board(p_token text, p_from date default null, p_to date default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'Europe/Istanbul')::date;
  f date := coalesce(p_from, today);
  t date := coalesce(p_to, p_from, today);
  can_mark boolean;
begin
  if p_token is null then
    -- anahtar yoksa: giriş yapmış, açık güvenlik hesabı
    if coalesce((select (public.guard_account() ->> 'active')::boolean), false) then can_mark := true; end if;
  else
    select g.token = p_token into can_mark from private.guard_link g
    where g.id = 1 and (g.token = p_token or g.view_token = p_token);
  end if;
  if can_mark is null then
    raise exception 'Güvenlik linki geçersiz' using errcode = '42501';
  end if;
  if t < f then raise exception 'Bitiş tarihi başlangıçtan önce olamaz' using errcode = '22023'; end if;
  if t - f > 31 then raise exception 'En fazla 31 günlük aralık seçilebilir' using errcode = '22023'; end if;
  if f < today - 62 or t > today + 7 then raise exception 'Güvenlik ekranında en fazla 2 ay öncesi gösterilir' using errcode = '22023'; end if;
  return jsonb_build_object(
    'today', today, 'from', f, 'to', t,
    'now', now(), 'can_mark', can_mark,
    'visits', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', v.id, 'plate', v.plate, 'customer', v.customer, 'registration', v.registration, 'visit_date', v.visit_date,
               'visit_time', v.visit_time, 'onsite', v.onsite, 'onsite_at', v.onsite_at,
               'done', v.done, 'done_at', v.done_at, 'exit_at', v.exit_at)
             order by v.visit_date, v.visit_time nulls last, v.plate)
      from public.visits v
      where v.visit_date between f and t
         or (t >= today and v.visit_date >= today - 7 and v.visit_date < f and v.onsite_at is not null and v.exit_at is null)
         or (v.visit_date >= f - 7 and v.visit_date < f and v.exit_at is not null
             and (v.exit_at at time zone 'Europe/Istanbul')::date between f and t)
    ), '[]'::jsonb));
end $$;

-- Güvenlik ekranından giriş / çıkış / geri alma
create or replace function public.guard_mark(p_token text, p_visit_id text, p_action text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'Europe/Istanbul')::date;
  v public.visits%rowtype;
  acct jsonb;
  who text := 'Güvenlik';
begin
  if p_token is null then
    acct := public.guard_account();
    if not coalesce((acct ->> 'active')::boolean, false) then
      raise exception 'Güvenlik hesabı kapalı' using errcode = '42501';
    end if;
    who := 'Güvenlik · ' || (acct ->> 'name');
  elsif not exists (select 1 from private.guard_link g where g.id = 1 and g.token = p_token) then
    raise exception 'Güvenlik linki geçersiz' using errcode = '42501';
  end if;
  -- yalnızca son 7 gün ile yarın arasındaki araçlar işaretlenebilir
  select * into v from public.visits x where x.id::text = p_visit_id and x.visit_date between today - 7 and today + 1 for update;
  if not found then raise exception 'Araç bulunamadı' using errcode = 'P0002'; end if;
  perform set_config('pcs.actor', who, true);

  if p_action = 'giris' then
    update public.visits set onsite = true, onsite_at = coalesce(onsite_at, now()) where id = v.id;
  elsif p_action = 'cikis' then
    if not v.onsite and v.onsite_at is null then
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
do $$ declare r record; begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r', 'p') loop
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

-- Kontrol: beş satır da "tamam" olmalı. Son satırda "UYARI · RLS kapalı" yazan tablo varsa o tabloyu sitedeki
-- anahtarı bilen herkes okuyabilir ve güvenlik hesapları da engellenemez (README bölüm 2).
select 'çıkış saati sütunu' as kontrol,
       case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'visits' and column_name = 'exit_at') then 'tamam' else 'EKSİK' end as durum
union all
select 'güvenlik fonksiyonları', case when count(*) = 11 then 'tamam' else 'EKSİK' end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('get_guard_link', 'rotate_guard_link', 'get_guard_view_link', 'rotate_guard_view_link', 'guard_board', 'guard_mark',
                                              'guard_account', 'is_guard_account', 'list_guard_accounts', 'save_guard_account', 'delete_guard_account')
union all
select 'link anahtarları (güvenlik + izleme)', case when exists (select 1 from information_schema.columns where table_schema = 'private' and table_name = 'guard_link' and column_name = 'view_token') then 'tamam' else 'EKSİK' end
union all
select 'işlem geçmişi (çıkış)', case when pg_get_functiondef('public.pcs_log_visit'::regproc) like '%exit_on%' then 'tamam' else 'EKSİK' end
union all
select 'güvenlik hesapları tablolara erişemez',
       coalesce('UYARI · RLS kapalı: ' || string_agg(c.relname, ', ' order by c.relname)
                filter (where not c.relrowsecurity
                          and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('authenticated', c.oid, 'select'))), 'tamam')
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p');
