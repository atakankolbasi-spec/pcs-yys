-- Otomatik günlük rapor (e-posta): veritabanı kurulumu.
--
-- Her iş günü 23:59'da GitHub'daki "Günlük rapor maili" görevi günün araçlarını okur ve rapor mailini
-- (özet + günlük Excel) gönderir. Alıcılar ve açık/kapalı durumu sitede Ayarlar > Otomatik günlük
-- rapor bölümünden yönetilir (yalnızca düzenleyici).
--
-- Görev veritabanına "rapor anahtarı" ile bağlanır: anahtar Ayarlar'da görünür ve GitHub'a gizli değer
-- olarak girilir. Anahtarı bilen, bir günün araç listesini (müşteri, plaka, beyanname, nakliyeci, saatler)
-- okuyabilir; başka hiçbir şey yapamaz. Anahtar yanlış ellere geçerse Ayarlar'dan yenilenir.
--
-- Supabase > SQL Editor'de bir kez çalıştırın. Tekrar çalıştırmak zararsızdır.

create table if not exists private.report_config (
  id int primary key default 1 check (id = 1),
  token text not null default replace(gen_random_uuid()::text, '-', ''),
  enabled boolean not null default false,
  recipients text[] not null default '{}',
  last_run_at timestamptz,
  last_ok boolean,
  last_note text
);
insert into private.report_config (id) values (1) on conflict (id) do nothing;
revoke all on private.report_config from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on private.report_config from anon'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'revoke all on private.report_config from authenticated'; end if;
end $$;

-- Düzenleyici: ayarları göster (anahtar dahil) / kaydet / anahtarı yenile
create or replace function public.get_report_settings() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not coalesce((select private.is_editor()), false) then
    raise exception 'Bu işlem için düzenleyici yetkisi gerekli' using errcode = '42501';
  end if;
  return (select jsonb_build_object('enabled', c.enabled, 'recipients', to_jsonb(c.recipients), 'token', c.token,
                                    'last_run_at', c.last_run_at, 'last_ok', c.last_ok, 'last_note', c.last_note)
          from private.report_config c where c.id = 1);
end $$;

create or replace function public.save_report_settings(p_enabled boolean, p_recipients text[]) returns jsonb
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
  if coalesce(array_length(r, 1), 0) > 20 then
    raise exception 'En fazla 20 alıcı eklenebilir' using errcode = '22023';
  end if;
  update private.report_config set enabled = coalesce(p_enabled, false), recipients = r where id = 1;
  return public.get_report_settings();
end $$;

create or replace function public.rotate_report_token() returns text
language plpgsql security definer set search_path = '' as $$
declare t text := replace(gen_random_uuid()::text, '-', '');
begin
  if not coalesce((select private.is_editor()), false) then
    raise exception 'Bu işlem için düzenleyici yetkisi gerekli' using errcode = '42501';
  end if;
  update private.report_config set token = t where id = 1;
  return t;
end $$;

-- GitHub görevi: bir günün raporu için veriler (anahtarla)
create or replace function public.report_day(p_token text, p_date date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c private.report_config%rowtype;
begin
  select * into c from private.report_config where id = 1;
  if p_token is null or c.token is distinct from p_token then
    raise exception 'Rapor anahtarı geçersiz' using errcode = '42501';
  end if;
  if p_date is null then raise exception 'Tarih gerekli' using errcode = '22023'; end if;
  return jsonb_build_object(
    'date', p_date, 'enabled', c.enabled, 'recipients', to_jsonb(c.recipients),
    'customer_priority', coalesce((select s.value from public.app_settings s where s.key = 'customer_priority'), '[]'::jsonb),
    'visits', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', v.id, 'plate', v.plate, 'customer', v.customer, 'declaration', v.declaration, 'carrier', v.carrier,
               'registration', v.registration, 'visit_date', v.visit_date, 'visit_time', v.visit_time, 'note', v.note,
               'onsite', v.onsite, 't1', v.t1, 'done', v.done, 'onsite_at', v.onsite_at, 'done_at', v.done_at,
               'exit_at', v.exit_at, 'sort_order', v.sort_order, 'created_at', v.created_at)
             order by v.visit_time nulls last, v.plate)
      from public.visits v where v.visit_date = p_date
    ), '[]'::jsonb));
end $$;

-- GitHub görevi: gönderim sonucunu yaz (Ayarlar'da "son rapor" olarak görünür)
create or replace function public.report_log(p_token text, p_ok boolean, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update private.report_config set last_run_at = now(), last_ok = p_ok, last_note = left(coalesce(p_note, ''), 300)
  where id = 1 and p_token is not null and token = p_token;
  if not found then raise exception 'Rapor anahtarı geçersiz' using errcode = '42501'; end if;
end $$;

revoke all on function public.get_report_settings(), public.save_report_settings(boolean, text[]), public.rotate_report_token(),
  public.report_day(text, date), public.report_log(text, boolean, text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.get_report_settings(), public.save_report_settings(boolean, text[]), public.rotate_report_token() from anon';
    execute 'grant execute on function public.report_day(text, date), public.report_log(text, boolean, text) to anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.get_report_settings(), public.save_report_settings(boolean, text[]), public.rotate_report_token() to authenticated';
    execute 'grant execute on function public.report_day(text, date), public.report_log(text, boolean, text) to authenticated';
  end if;
end $$;

notify pgrst, 'reload schema';

-- Kontrol: iki satır da "tamam" olmalı.
select 'rapor ayarları' as kontrol, case when exists (select 1 from private.report_config where id = 1) then 'tamam' else 'EKSİK' end as durum
union all
select 'rapor fonksiyonları', case when count(*) = 5 then 'tamam' else 'EKSİK' end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('get_report_settings', 'save_report_settings', 'rotate_report_token', 'report_day', 'report_log');
