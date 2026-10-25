-- Gece yedeği (e-posta): veritabanı kurulumu.
--
-- Her gece 02:30'da GitHub'daki "Gece yedeği" görevi bütün plaka kayıtlarını, gelişleri ve ayarları okuyup
-- yedek dosyalarını e-postayla gönderir (JSON + iki CSV). Böylece verinin, Supabase'in dışında, e-posta kutunuzda
-- da bir kopyası bulunur. Alıcılar ve açık/kapalı durumu sitede Ayarlar > Rapor ve yedek bölümünden yönetilir
-- (yalnızca düzenleyici).
--
-- Önce gunluk-rapor-kurulumu.sql çalıştırılmış olmalı: görev, günlük raporla aynı "rapor anahtarı"nı kullanır
-- (GitHub'a yeni bir gizli değer girmek gerekmez). Anahtarı bilen, yedekteki bütün kayıtları okuyabilir; yanlış ellere
-- geçerse Ayarlar'dan yenilenir.
--
-- Supabase > SQL Editor'de bir kez çalıştırın. Tekrar çalıştırmak zararsızdır.

alter table private.report_config add column if not exists backup_enabled boolean not null default false;
alter table private.report_config add column if not exists backup_recipients text[] not null default '{}';
alter table private.report_config add column if not exists backup_last_at timestamptz;
alter table private.report_config add column if not exists backup_last_ok boolean;
alter table private.report_config add column if not exists backup_last_note text;

-- Düzenleyici: yedek ayarlarını göster / kaydet
create or replace function public.get_backup_settings() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not coalesce((select private.is_editor()), false) then
    raise exception 'Bu işlem için düzenleyici yetkisi gerekli' using errcode = '42501';
  end if;
  return (select jsonb_build_object('enabled', c.backup_enabled, 'recipients', to_jsonb(c.backup_recipients),
                                    'last_at', c.backup_last_at, 'last_ok', c.backup_last_ok, 'last_note', c.backup_last_note)
          from private.report_config c where c.id = 1);
end $$;

create or replace function public.save_backup_settings(p_enabled boolean, p_recipients text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r text[];
begin
  if not coalesce((select private.is_editor()), false) then
    raise exception 'Bu işlem için düzenleyici yetkisi gerekli' using errcode = '42501';
  end if;
  select coalesce(array_agg(distinct e order by e), '{}') into r
  from (select lower(btrim(x)) as e from unnest(coalesce(p_recipients, '{}')) as x) s where e <> '';
  if exists (select 1 from unnest(r) e where e !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$') then
    raise exception 'Geçersiz e-posta adresi var; her satıra bir adres yazın' using errcode = '22023';
  end if;
  if coalesce(array_length(r, 1), 0) > 5 then
    raise exception 'Yedek en fazla 5 adrese gönderilebilir' using errcode = '22023';
  end if;
  update private.report_config set backup_enabled = coalesce(p_enabled, false), backup_recipients = r where id = 1;
  return public.get_backup_settings();
end $$;

-- GitHub görevi: bir tablonun bir sayfası (anahtarla). Tablolar: registry, visits, app_settings. En fazla 2000 satır.
create or replace function public.backup_page(p_token text, p_table text, p_offset int, p_limit int) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c private.report_config%rowtype; n int := least(greatest(coalesce(p_limit, 1000), 1), 2000); o int := greatest(coalesce(p_offset, 0), 0); rows jsonb;
begin
  select * into c from private.report_config where id = 1;
  if p_token is null or c.token is distinct from p_token then
    raise exception 'Rapor anahtarı geçersiz' using errcode = '42501';
  end if;
  if p_table = 'registry' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) into rows
    from (select * from public.registry order by id offset o limit n) t;
  elsif p_table = 'visits' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) into rows
    from (select * from public.visits order by id offset o limit n) t;
  elsif p_table = 'app_settings' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.key), '[]'::jsonb) into rows
    from (select * from public.app_settings order by key offset o limit n) t;
  else
    raise exception 'Bilinmeyen tablo' using errcode = '22023';
  end if;
  return jsonb_build_object('enabled', c.backup_enabled, 'recipients', to_jsonb(c.backup_recipients), 'rows', rows);
end $$;

-- GitHub görevi: yedeğin sonucunu yaz (Ayarlar'da "son yedek" olarak görünür)
create or replace function public.backup_log(p_token text, p_ok boolean, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update private.report_config set backup_last_at = now(), backup_last_ok = p_ok, backup_last_note = left(coalesce(p_note, ''), 300)
  where id = 1 and p_token is not null and token = p_token;
  if not found then raise exception 'Rapor anahtarı geçersiz' using errcode = '42501'; end if;
end $$;

revoke all on function public.get_backup_settings(), public.save_backup_settings(boolean, text[]),
  public.backup_page(text, text, int, int), public.backup_log(text, boolean, text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.get_backup_settings(), public.save_backup_settings(boolean, text[]) from anon';
    execute 'grant execute on function public.backup_page(text, text, int, int), public.backup_log(text, boolean, text) to anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.get_backup_settings(), public.save_backup_settings(boolean, text[]) to authenticated';
    execute 'grant execute on function public.backup_page(text, text, int, int), public.backup_log(text, boolean, text) to authenticated';
  end if;
end $$;

notify pgrst, 'reload schema';

-- Kontrol: iki satır da "tamam" olmalı.
select 'yedek ayarları' as kontrol, case when exists (select 1 from information_schema.columns
  where table_schema = 'private' and table_name = 'report_config' and column_name = 'backup_enabled') then 'tamam' else 'EKSİK (önce gunluk-rapor-kurulumu.sql)' end as durum
union all
select 'yedek fonksiyonları', case when count(*) = 4 then 'tamam' else 'EKSİK' end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('get_backup_settings', 'save_backup_settings', 'backup_page', 'backup_log');
