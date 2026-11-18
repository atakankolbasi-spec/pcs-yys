-- Nakliye programı: veritabanı kurulumu.
--
-- Müşteri (nakliye firması) kendi bağlantısından gelecek yüklerini yazar; depodaki arkadaşlar yük gelince "Geldi" der;
-- operatör boştaki yükleri seçip bir araca (plakaya) atar, Lade Liste ve CMR belgeleri sitede hazırlanır.
--   * Bir araç (sefer) yalnızca tek bir müşterinin yüklerini taşır. Her sefere otomatik Poz No verilir: PCS-26-0001, PCS-26-0002 ...
--     (yıl değişince PCS-27-0001'den yeniden başlar). CMR numaraları Poz No'ya /01, /02 ... eklenerek yazılır.
--   * Araca atanan yük "boşta" listesinden çıkar, plakanın altında durur; yanlış atanan yük araçtan çıkarılabilir.
--   * Müşteri bağlantısı yalnızca o müşterinin yüklerini, depo bağlantısı bekleyen ve boştaki yükleri ile plaka bazında seferleri gösterir.
--     Bağlantılar giriş şifresi istemez; Ayarlar'dan değil, sitedeki Nakliye > Müşteriler ve bağlantılar penceresinden
--     yenilenir ya da kapatılır (eski bağlantı çalışmaz).
--
-- Önce whatsapp-kurulumu.sql (private.is_editor() için) çalıştırılmış olmalı.
-- Supabase > SQL Editor'de bir kez çalıştırın. Tekrar çalıştırmak zararsızdır.

create schema if not exists private;

-- ---------------------------------------------------------------- tablolar
create table if not exists public.shp_customers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) between 1 and 120),
  carrier text not null default '' check (length(carrier) <= 600),        -- CMR 16. kutu: nakliyeci adı, adresi, telefon
  cmr_notes text not null default '' check (length(cmr_notes) <= 1500),   -- CMR 18. kutu: nakliyecinin şart ve mülahazaları
  loading_place text not null default 'İSTANBUL - Turkey' check (length(loading_place) <= 120),  -- CMR 4. ve 21. kutu
  logo text not null default '' check (length(logo) <= 300000),           -- Lade Liste ve CMR üstündeki küçük resim (data:image/...)
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shp_trips (
  id uuid primary key default gen_random_uuid(),
  poz_no text not null unique,
  customer_id uuid not null references public.shp_customers (id),
  tractor text not null default '' check (length(tractor) <= 30),
  trailer text not null default '' check (length(trailer) <= 30),
  depart_date date not null default ((now() at time zone 'Europe/Istanbul')::date),
  subject text not null default '' check (length(subject) <= 200),
  status text not null default 'hazirlaniyor' check (status in ('hazirlaniyor', 'yolda', 'teslim')),
  created_by text not null default '' check (length(created_by) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shp_loads (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.shp_customers (id),
  sender text not null check (length(btrim(sender)) between 1 and 200),
  sender_addr text not null default '' check (length(sender_addr) <= 300),
  consignee text not null check (length(btrim(consignee)) between 1 and 200),
  consignee_addr text not null default '' check (length(consignee_addr) <= 300),
  notify text not null default '' check (length(notify) <= 300),
  pieces integer not null default 0 check (pieces between 0 and 1000000),
  packing text not null default 'KAP' check (length(packing) <= 40),
  goods text not null default '' check (length(goods) <= 200),
  weight numeric(12, 2) not null default 0 check (weight >= 0 and weight < 10000000),
  volume numeric(10, 3) check (volume is null or (volume >= 0 and volume < 1000000)),
  country text not null default '' check (length(country) <= 60),
  code text not null default '' check (length(code) <= 40),
  dest_customs text not null default '' check (length(dest_customs) <= 80),
  broker text not null default '' check (length(broker) <= 120),
  expected_date date,
  status text not null default 'bekliyor' check (status in ('bekliyor', 'depoda', 'aracta')),
  arrived_at timestamptz,
  arrived_by text not null default '' check (length(arrived_by) <= 120),
  trip_id uuid references public.shp_trips (id),
  note text not null default '' check (length(note) <= 500),
  created_by text not null default '' check (length(created_by) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'aracta') = (trip_id is not null))
);

create index if not exists shp_loads_durum on public.shp_loads (status, customer_id);
create index if not exists shp_loads_sefer on public.shp_loads (trip_id);
create index if not exists shp_trips_musteri on public.shp_trips (customer_id, created_at desc);

create or replace function public.shp_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists shp_customers_touch on public.shp_customers;
create trigger shp_customers_touch before update on public.shp_customers for each row execute function public.shp_touch();
drop trigger if exists shp_trips_touch on public.shp_trips;
create trigger shp_trips_touch before update on public.shp_trips for each row execute function public.shp_touch();
drop trigger if exists shp_loads_touch on public.shp_loads;
create trigger shp_loads_touch before update on public.shp_loads for each row execute function public.shp_touch();

-- Poz No sayacı (yıla göre) ve bağlantı anahtarları: yalnızca sunucu fonksiyonları erişir
create table if not exists private.shp_counter (
  year int primary key,
  n int not null default 0
);
create table if not exists private.shp_links (
  token text primary key,
  kind text not null check (kind in ('musteri', 'depo')),
  customer_id uuid references public.shp_customers (id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((kind = 'musteri') = (customer_id is not null))
);
create unique index if not exists shp_links_tek on private.shp_links ((coalesce(customer_id::text, 'depo')));
revoke all on private.shp_counter, private.shp_links from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on private.shp_counter, private.shp_links from anon'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'revoke all on private.shp_counter, private.shp_links from authenticated'; end if;
end $$;

-- ---------------------------------------------------------------- yetki: tabloları yalnızca düzenleyiciler okur ve yazar
alter table public.shp_customers enable row level security;
alter table public.shp_trips enable row level security;
alter table public.shp_loads enable row level security;
revoke all on public.shp_customers, public.shp_trips, public.shp_loads from anon;
grant select, insert, update, delete on public.shp_customers, public.shp_trips, public.shp_loads to authenticated;

do $$ declare t text; begin
  foreach t in array array['shp_customers', 'shp_trips', 'shp_loads'] loop
    execute format('drop policy if exists %I on public.%I', t || '_editor', t);
    execute format('create policy %I on public.%I for all to authenticated using ((select private.is_editor())) with check ((select private.is_editor()))', t || '_editor', t);
  end loop;
end $$;

-- Güvenlik hesapları (guvenlik-kurulumu.sql) bu tablolara da erişemez
do $$ declare t text; begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'is_guard_account') then
    foreach t in array array['shp_customers', 'shp_trips', 'shp_loads'] loop
      execute format('drop policy if exists guvenlik_hesabi_erisemez on public.%I', t);
      execute format('create policy guvenlik_hesabi_erisemez on public.%I as restrictive for all to authenticated '
                     'using (not (select public.is_guard_account())) with check (not (select public.is_guard_account()))', t);
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------- Poz No
create or replace function private.shp_next_poz() returns text
language plpgsql security definer set search_path = '' as $$
declare
  y int := extract(year from (now() at time zone 'Europe/Istanbul'))::int;
  k int;
begin
  insert into private.shp_counter (year, n) values (y, 1)
  on conflict (year) do update set n = private.shp_counter.n + 1
  returning n into k;
  return 'PCS-' || lpad((y % 100)::text, 2, '0') || '-' || lpad(k::text, 4, '0');
end $$;

-- ---------------------------------------------------------------- operatör: araca ata / araçtan çıkar / seferi sil
create or replace function public.shp_assign(p_customer uuid, p_load_ids uuid[], p_tractor text, p_trailer text,
                                             p_depart date default null, p_subject text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t public.shp_trips;
  n int;
  who text := coalesce(nullif(btrim(coalesce(auth.jwt() ->> 'email', '')), ''), 'operatör');
begin
  if not coalesce((select private.is_editor()), false) then
    raise exception 'Bu işlem için düzenleyici yetkisi gerekli' using errcode = '42501';
  end if;
  if p_load_ids is null or coalesce(array_length(p_load_ids, 1), 0) = 0 then
    raise exception 'Önce yük seçin' using errcode = '22023';
  end if;
  if btrim(coalesce(p_tractor, '')) = '' then
    raise exception 'Çekici plakası gerekli' using errcode = '22023';
  end if;
  -- seçilen yükleri kilitle ve doğrula: hepsi var, hepsi boşta (depoda) ve hepsi aynı müşterinin
  select count(*) into n from (
    select l.id from public.shp_loads l
    where l.id = any (p_load_ids) and l.status = 'depoda' and l.trip_id is null and l.customer_id = p_customer
    for update
  ) x;
  if n <> (select count(distinct i) from unnest(p_load_ids) i) then
    raise exception 'Seçilen yüklerden bazıları artık boşta değil ya da başka müşteriye ait; listeyi yenileyip tekrar seçin' using errcode = '22023';
  end if;
  insert into public.shp_trips (poz_no, customer_id, tractor, trailer, depart_date, subject, created_by)
  values (private.shp_next_poz(), p_customer, upper(left(btrim(p_tractor), 30)), upper(left(btrim(coalesce(p_trailer, '')), 30)),
          coalesce(p_depart, (now() at time zone 'Europe/Istanbul')::date), left(btrim(coalesce(p_subject, '')), 200), left(who, 120))
  returning * into t;
  update public.shp_loads set status = 'aracta', trip_id = t.id where id = any (p_load_ids);
  return jsonb_build_object('trip', to_jsonb(t));
end $$;

create or replace function public.shp_unassign(p_load_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  tid uuid;
  gone boolean := false;
begin
  if not coalesce((select private.is_editor()), false) then
    raise exception 'Bu işlem için düzenleyici yetkisi gerekli' using errcode = '42501';
  end if;
  select l.trip_id into tid from public.shp_loads l where l.id = p_load_id and l.status = 'aracta' for update;
  if tid is null then raise exception 'Yük bir araçta değil' using errcode = '22023'; end if;
  update public.shp_loads set status = 'depoda', trip_id = null where id = p_load_id;
  if not exists (select 1 from public.shp_loads l where l.trip_id = tid) then
    delete from public.shp_trips where id = tid;
    gone := true;
  end if;
  return jsonb_build_object('trip_deleted', gone);
end $$;

create or replace function public.shp_delete_trip(p_trip uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce((select private.is_editor()), false) then
    raise exception 'Bu işlem için düzenleyici yetkisi gerekli' using errcode = '42501';
  end if;
  update public.shp_loads set status = 'depoda', trip_id = null where trip_id = p_trip;
  delete from public.shp_trips where id = p_trip;
end $$;

-- ---------------------------------------------------------------- bağlantılar (yalnızca düzenleyici görür / yeniler)
create or replace function public.shp_links() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if not coalesce((select private.is_editor()), false) then
    raise exception 'Bu işlem için düzenleyici yetkisi gerekli' using errcode = '42501';
  end if;
  -- her müşteriye ve depoya bir anahtar (yoksa oluşturulur)
  for r in select c.id from public.shp_customers c where not exists (select 1 from private.shp_links k where k.customer_id = c.id) loop
    insert into private.shp_links (token, kind, customer_id) values (replace(gen_random_uuid()::text, '-', ''), 'musteri', r.id);
  end loop;
  if not exists (select 1 from private.shp_links k where k.kind = 'depo') then
    insert into private.shp_links (token, kind) values (replace(gen_random_uuid()::text, '-', ''), 'depo');
  end if;
  return jsonb_build_object(
    'depot', (select jsonb_build_object('token', k.token, 'active', k.active) from private.shp_links k where k.kind = 'depo'),
    'customers', coalesce((select jsonb_agg(jsonb_build_object('customer_id', c.id, 'name', c.name, 'token', k.token, 'active', k.active) order by c.name)
                           from public.shp_customers c join private.shp_links k on k.customer_id = c.id), '[]'::jsonb));
end $$;

-- p_customer: müşterinin kimliği; boş bırakılırsa depo bağlantısı
create or replace function public.shp_rotate_link(p_customer uuid default null) returns text
language plpgsql security definer set search_path = '' as $$
declare t text := replace(gen_random_uuid()::text, '-', '');
begin
  if not coalesce((select private.is_editor()), false) then
    raise exception 'Bu işlem için düzenleyici yetkisi gerekli' using errcode = '42501';
  end if;
  if p_customer is null then
    update private.shp_links set token = t, created_at = now() where kind = 'depo';
    if not found then insert into private.shp_links (token, kind) values (t, 'depo'); end if;
  else
    update private.shp_links set token = t, created_at = now() where customer_id = p_customer;
    if not found then insert into private.shp_links (token, kind, customer_id) values (t, 'musteri', p_customer); end if;
  end if;
  return t;
end $$;

create or replace function public.shp_set_link(p_customer uuid, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce((select private.is_editor()), false) then
    raise exception 'Bu işlem için düzenleyici yetkisi gerekli' using errcode = '42501';
  end if;
  if p_customer is null then
    update private.shp_links set active = coalesce(p_active, true) where kind = 'depo';
  else
    update private.shp_links set active = coalesce(p_active, true) where customer_id = p_customer;
  end if;
end $$;

-- ---------------------------------------------------------------- müşteri bağlantısı
-- Yük satırının sitede kullanılan alanları (tek yerde: portal ve depo aynı biçimi görür)
create or replace function private.shp_load_json(l public.shp_loads) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'id', l.id, 'customer_id', l.customer_id, 'sender', l.sender, 'sender_addr', l.sender_addr, 'consignee', l.consignee,
    'consignee_addr', l.consignee_addr, 'notify', l.notify, 'pieces', l.pieces, 'packing', l.packing, 'goods', l.goods,
    'weight', l.weight, 'volume', l.volume, 'country', l.country, 'code', l.code, 'dest_customs', l.dest_customs,
    'broker', l.broker, 'expected_date', l.expected_date, 'status', l.status, 'arrived_at', l.arrived_at,
    'arrived_by', l.arrived_by, 'trip_id', l.trip_id, 'note', l.note, 'created_at', l.created_at)
$$;

create or replace function private.shp_customer_json(c public.shp_customers) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('id', c.id, 'name', c.name, 'carrier', c.carrier, 'cmr_notes', c.cmr_notes,
                            'loading_place', c.loading_place, 'logo', c.logo)
$$;

create or replace function public.shp_portal(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k private.shp_links;
  c public.shp_customers;
begin
  select * into k from private.shp_links where token = p_token and kind = 'musteri' and active;
  if not found then raise exception 'Bağlantı geçersiz ya da kapatılmış' using errcode = '42501'; end if;
  select * into c from public.shp_customers where id = k.customer_id and active;
  if not found then raise exception 'Bağlantı geçersiz ya da kapatılmış' using errcode = '42501'; end if;
  return jsonb_build_object(
    'now', now(),
    'customer', private.shp_customer_json(c),
    'loads', coalesce((select jsonb_agg(private.shp_load_json(l) order by l.created_at desc)
                       from public.shp_loads l
                       where l.customer_id = c.id
                         and (l.status <> 'aracta' or l.updated_at > now() - interval '120 days')), '[]'::jsonb),
    'trips', coalesce((select jsonb_agg(to_jsonb(t) - 'created_by' order by t.created_at desc)
                       from public.shp_trips t where t.customer_id = c.id and t.created_at > now() - interval '120 days'), '[]'::jsonb));
end $$;

-- Metni temizle: boşlukları düzelt, uzunluğu sınırla
create or replace function private.shp_txt(p jsonb, k text, n int) returns text
language sql immutable set search_path = '' as $$
  select left(regexp_replace(btrim(coalesce(p ->> k, '')), '[\r\n\t]+', ' ', 'g'), n)
$$;

create or replace function public.shp_portal_save(p_token text, p_load jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k private.shp_links;
  l public.shp_loads;
  pid uuid := nullif(p_load ->> 'id', '')::uuid;
  w numeric;
  v numeric;
  pc int;
  ed date;
begin
  select * into k from private.shp_links where token = p_token and kind = 'musteri' and active;
  if not found then raise exception 'Bağlantı geçersiz ya da kapatılmış' using errcode = '42501'; end if;
  if private.shp_txt(p_load, 'sender', 200) = '' or private.shp_txt(p_load, 'consignee', 200) = '' then
    raise exception 'Gönderici ve alıcı yazılmalı' using errcode = '22023';
  end if;
  begin
    w := coalesce(nullif(p_load ->> 'weight', '')::numeric, 0);
    v := nullif(p_load ->> 'volume', '')::numeric;
    pc := coalesce(nullif(p_load ->> 'pieces', '')::int, 0);
    ed := nullif(p_load ->> 'expected_date', '')::date;
  exception when others then
    raise exception 'Kap, kilo, hacim ya da tarih sayı / tarih olarak okunamadı' using errcode = '22023';
  end;
  if w < 0 or w >= 10000000 or pc < 0 or pc > 1000000 or (v is not null and (v < 0 or v >= 1000000)) then
    raise exception 'Kap, kilo ya da hacim aralık dışında' using errcode = '22023';
  end if;
  if pid is null then
    if (select count(*) from public.shp_loads x where x.customer_id = k.customer_id and x.status <> 'aracta') >= 2000 then
      raise exception 'Açık yük sayısı sınırına ulaşıldı' using errcode = '22023';
    end if;
    insert into public.shp_loads (customer_id, sender, sender_addr, consignee, consignee_addr, notify, pieces, packing, goods, weight, volume,
                                  country, code, dest_customs, broker, expected_date, note, created_by)
    values (k.customer_id, private.shp_txt(p_load, 'sender', 200), private.shp_txt(p_load, 'sender_addr', 300),
            private.shp_txt(p_load, 'consignee', 200), private.shp_txt(p_load, 'consignee_addr', 300), private.shp_txt(p_load, 'notify', 300),
            pc, coalesce(nullif(private.shp_txt(p_load, 'packing', 40), ''), 'KAP'), private.shp_txt(p_load, 'goods', 200), w, v,
            private.shp_txt(p_load, 'country', 60), private.shp_txt(p_load, 'code', 40), private.shp_txt(p_load, 'dest_customs', 80),
            private.shp_txt(p_load, 'broker', 120), ed, private.shp_txt(p_load, 'note', 500), 'Müşteri')
    returning * into l;
  else
    update public.shp_loads set sender = private.shp_txt(p_load, 'sender', 200), sender_addr = private.shp_txt(p_load, 'sender_addr', 300),
      consignee = private.shp_txt(p_load, 'consignee', 200), consignee_addr = private.shp_txt(p_load, 'consignee_addr', 300),
      notify = private.shp_txt(p_load, 'notify', 300), pieces = pc, packing = coalesce(nullif(private.shp_txt(p_load, 'packing', 40), ''), 'KAP'),
      goods = private.shp_txt(p_load, 'goods', 200), weight = w, volume = v, country = private.shp_txt(p_load, 'country', 60),
      code = private.shp_txt(p_load, 'code', 40), dest_customs = private.shp_txt(p_load, 'dest_customs', 80),
      broker = private.shp_txt(p_load, 'broker', 120), expected_date = ed, note = private.shp_txt(p_load, 'note', 500)
    where id = pid and customer_id = k.customer_id and status = 'bekliyor'
    returning * into l;
    if not found then raise exception 'Yük bulunamadı ya da depoya geldiği için artık değiştirilemez' using errcode = '22023'; end if;
  end if;
  return private.shp_load_json(l);
end $$;

create or replace function public.shp_portal_delete(p_token text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare k private.shp_links;
begin
  select * into k from private.shp_links where token = p_token and kind = 'musteri' and active;
  if not found then raise exception 'Bağlantı geçersiz ya da kapatılmış' using errcode = '42501'; end if;
  delete from public.shp_loads where id = p_id and customer_id = k.customer_id and status = 'bekliyor';
  if not found then raise exception 'Yük bulunamadı ya da depoya geldiği için silinemez' using errcode = '22023'; end if;
end $$;

-- ---------------------------------------------------------------- depo bağlantısı
create or replace function public.shp_depot(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k private.shp_links;
begin
  select * into k from private.shp_links where token = p_token and kind = 'depo' and active;
  if not found then raise exception 'Bağlantı geçersiz ya da kapatılmış' using errcode = '42501'; end if;
  return jsonb_build_object(
    'now', now(),
    'customers', coalesce((select jsonb_agg(private.shp_customer_json(c) order by c.name) from public.shp_customers c where c.active), '[]'::jsonb),
    'loads', coalesce((select jsonb_agg(private.shp_load_json(l) order by l.created_at desc)
                       from public.shp_loads l
                       where l.status <> 'aracta' or l.updated_at > now() - interval '30 days'), '[]'::jsonb),
    'trips', coalesce((select jsonb_agg(to_jsonb(t) - 'created_by' order by t.created_at desc)
                       from public.shp_trips t where t.created_at > now() - interval '30 days'), '[]'::jsonb));
end $$;

create or replace function public.shp_depot_mark(p_token text, p_id uuid, p_arrived boolean, p_name text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k private.shp_links;
  l public.shp_loads;
begin
  select * into k from private.shp_links where token = p_token and kind = 'depo' and active;
  if not found then raise exception 'Bağlantı geçersiz ya da kapatılmış' using errcode = '42501'; end if;
  if coalesce(p_arrived, true) then
    update public.shp_loads set status = 'depoda', arrived_at = now(), arrived_by = left(btrim(coalesce(p_name, '')), 120)
    where id = p_id and status in ('bekliyor', 'depoda') returning * into l;
  else
    update public.shp_loads set status = 'bekliyor', arrived_at = null, arrived_by = ''
    where id = p_id and status = 'depoda' returning * into l;
  end if;
  if not found then raise exception 'Yük bulunamadı ya da araca verildiği için değiştirilemez' using errcode = '22023'; end if;
  return private.shp_load_json(l);
end $$;

-- ---------------------------------------------------------------- yetkiler
revoke all on function public.shp_assign(uuid, uuid[], text, text, date, text), public.shp_unassign(uuid), public.shp_delete_trip(uuid),
  public.shp_links(), public.shp_rotate_link(uuid), public.shp_set_link(uuid, boolean),
  public.shp_portal(text), public.shp_portal_save(text, jsonb), public.shp_portal_delete(text, uuid),
  public.shp_depot(text), public.shp_depot_mark(text, uuid, boolean, text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.shp_assign(uuid, uuid[], text, text, date, text), public.shp_unassign(uuid), public.shp_delete_trip(uuid), public.shp_links(), public.shp_rotate_link(uuid), public.shp_set_link(uuid, boolean) from anon';
    execute 'grant execute on function public.shp_portal(text), public.shp_portal_save(text, jsonb), public.shp_portal_delete(text, uuid), public.shp_depot(text), public.shp_depot_mark(text, uuid, boolean, text) to anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.shp_assign(uuid, uuid[], text, text, date, text), public.shp_unassign(uuid), public.shp_delete_trip(uuid), public.shp_links(), public.shp_rotate_link(uuid), public.shp_set_link(uuid, boolean) to authenticated';
    execute 'grant execute on function public.shp_portal(text), public.shp_portal_save(text, jsonb), public.shp_portal_delete(text, uuid), public.shp_depot(text), public.shp_depot_mark(text, uuid, boolean, text) to authenticated';
  end if;
end $$;

-- ---------------------------------------------------------------- anlık güncelleme: müşteri yük yazınca / depo "Geldi" deyince açık ekran hemen yenilenir
do $$ declare t text; begin
  foreach t in array array['shp_loads', 'shp_trips'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------- kontrol: dört satır da "tamam" olmalı
select 'tablolar (müşteri, sefer, yük)' as kontrol,
       case when to_regclass('public.shp_customers') is not null and to_regclass('public.shp_trips') is not null
                 and to_regclass('public.shp_loads') is not null then 'tamam' else 'EKSİK' end as durum
union all
select 'tablolara yalnızca düzenleyici erişir',
       case when (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'public' and c.relname in ('shp_customers', 'shp_trips', 'shp_loads') and c.relrowsecurity) = 3
            then 'tamam' else 'EKSİK' end
union all
select 'araca atama ve Poz No',
       case when to_regprocedure('public.shp_assign(uuid, uuid[], text, text, date, text)') is not null
                 and to_regprocedure('private.shp_next_poz()') is not null then 'tamam' else 'EKSİK' end
union all
select 'müşteri ve depo bağlantıları',
       case when to_regprocedure('public.shp_portal(text)') is not null and to_regprocedure('public.shp_depot(text)') is not null
                 and to_regprocedure('public.shp_links()') is not null then 'tamam' else 'EKSİK' end;
