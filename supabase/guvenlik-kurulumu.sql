-- Güvenlik linki ve ayrı çıkış saati: veritabanı kurulumu.
--
-- 1) visits tablosuna "exit_at" (tesisten çıkış saati) eklenir. "İşlemler bitti" saati (done_at)
--    ayrı kalır: biri gümrük işlemlerinin bittiği, diğeri aracın kapıdan çıktığı an.
-- 2) Güvenlik görevlilerinin giriş yapmadan açacağı link için gizli bir anahtar tutulur.
--    Linki yalnızca düzenleyiciler görür ve yeniler (Ayarlar > Güvenlik linki).
-- 3) Güvenlik ekranı yalnızca iki şey yapabilir:
--      GİRİŞ  -> araç TESİSTE olur, giriş saati yazılır
--      ÇIKIŞ  -> çıkış saati yazılır
--    Yanlış basılan düğme 15 dakika içinde geri alınabilir. Güvenlik ekranı yalnızca plaka, müşteri
--    ve saatleri görür; beyanname, nakliyeci, ruhsat gibi bilgileri göremez. Tarih aralığı seçilebilir
--    (en fazla 31 gün, en fazla 2 ay öncesi); işaretleme yalnızca son 7 gün ile yarın arasındaki araçlarda.
-- 4) İşlem geçmişine çıkış kayıtları eklenir; güvenlikten yapılan işlemler "Güvenlik" adıyla görünür.
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
revoke all on private.guard_link from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on private.guard_link from anon'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'revoke all on private.guard_link from authenticated'; end if;
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

-- Güvenlik ekranının listesi: seçilen tarih aralığının araçları (varsayılan bugün) + aralık bugünü
-- kapsıyorsa son 7 günden girip henüz çıkmamış olanlar + önceki günlerden gelip bu aralıkta çıkanlar
-- ("Çıkanlar"da görünsün, paylaşılabilsin). En fazla 31 günlük aralık, en fazla 2 ay öncesi.
drop function if exists public.guard_board(text);
create or replace function public.guard_board(p_token text, p_from date default null, p_to date default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'Europe/Istanbul')::date;
  f date := coalesce(p_from, today);
  t date := coalesce(p_to, p_from, today);
begin
  if p_token is null or not exists (select 1 from private.guard_link g where g.id = 1 and g.token = p_token) then
    raise exception 'Güvenlik linki geçersiz' using errcode = '42501';
  end if;
  if t < f then raise exception 'Bitiş tarihi başlangıçtan önce olamaz' using errcode = '22023'; end if;
  if t - f > 31 then raise exception 'En fazla 31 günlük aralık seçilebilir' using errcode = '22023'; end if;
  if f < today - 62 or t > today + 7 then raise exception 'Güvenlik ekranında en fazla 2 ay öncesi gösterilir' using errcode = '22023'; end if;
  return jsonb_build_object(
    'today', today, 'from', f, 'to', t,
    'now', now(),
    'visits', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', v.id, 'plate', v.plate, 'customer', v.customer, 'visit_date', v.visit_date,
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
begin
  if p_token is null or not exists (select 1 from private.guard_link g where g.id = 1 and g.token = p_token) then
    raise exception 'Güvenlik linki geçersiz' using errcode = '42501';
  end if;
  -- yalnızca son 7 gün ile yarın arasındaki araçlar işaretlenebilir
  select * into v from public.visits x where x.id::text = p_visit_id and x.visit_date between today - 7 and today + 1 for update;
  if not found then raise exception 'Araç bulunamadı' using errcode = 'P0002'; end if;
  perform set_config('pcs.actor', 'Güvenlik', true);

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

revoke all on function public.get_guard_link(), public.rotate_guard_link() from public;
revoke all on function public.guard_board(text, date, date), public.guard_mark(text, text, text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.get_guard_link(), public.rotate_guard_link() from anon';
    execute 'grant execute on function public.guard_board(text, date, date), public.guard_mark(text, text, text) to anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.get_guard_link(), public.rotate_guard_link() to authenticated';
    execute 'grant execute on function public.guard_board(text, date, date), public.guard_mark(text, text, text) to authenticated';
  end if;
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
  -- güvenlik linkinden yapılan işlemlerde oturum yok; guard_mark "Güvenlik" adını bırakır
  em := coalesce(em, nullif(current_setting('pcs.actor', true), ''));

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

-- Kontrol: dört satır da "tamam" olmalı.
select 'çıkış saati sütunu' as kontrol,
       case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'visits' and column_name = 'exit_at') then 'tamam' else 'EKSİK' end as durum
union all
select 'güvenlik fonksiyonları', case when count(*) = 4 then 'tamam' else 'EKSİK' end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('get_guard_link', 'rotate_guard_link', 'guard_board', 'guard_mark')
union all
select 'link anahtarı tablosu', case when to_regclass('private.guard_link') is not null then 'tamam' else 'EKSİK' end
union all
select 'işlem geçmişi (çıkış)', case when pg_get_functiondef('public.pcs_log_visit'::regproc) like '%exit_on%' then 'tamam' else 'EKSİK' end;
