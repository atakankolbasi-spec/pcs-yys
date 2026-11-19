-- Nakliye programı: veritabanı kurulumu.
--
-- Müşteri (nakliye firması) kendi bağlantısından gelecek yüklerini yazar; depodaki arkadaşlar yük gelince "Geldi" der;
-- operatör boştaki yükleri seçip bir araca (plakaya) atar, Lade Liste ve CMR belgeleri sitede hazırlanır.
--   * Bir araç (sefer) yalnızca tek bir müşterinin yüklerini taşır. Her sefere otomatik Poz No verilir: PCS-26-0001, PCS-26-0002 ...
--     (yıl değişince PCS-27-0001'den yeniden başlar). CMR numaraları Poz No'ya /01, /02 ... eklenerek yazılır.
--   * Araca atanan yük "boşta" listesinden çıkar, plakanın altında durur; yanlış atanan yük araçtan çıkarılabilir.
--   * Müşteri de kendi sayfasında yüklerini araçlara yerleştirebilir (depoya henüz gelmemiş yük de olur); bu atama kesindir ve
--     Poz No otomatik verilir. Sefer "yola çıktı" diye kilitlenirse müşteri artık değiştiremez. Yükün depoya gelip gelmediği
--     (arrived_at) araca atanınca da korunur; depo araçtaki yüke de "Geldi" der.
--   * Müşteri bağlantısı yalnızca o müşterinin yüklerini, depo bağlantısı bekleyen ve boştaki yükleri ile plaka bazında seferleri gösterir.
--     Depo bağlantısı şifre istemez. Müşteri bağlantısı, müşteriye kullanıcı tanımlanmadıkça şifre istemez; kullanıcı tanımlanınca
--     kullanıcı adı ve şifreyle girilir (Nakliye > Müşteriler > Kullanıcılar). Bağlantılar Nakliye > Bağlantılar penceresinden
--     yenilenir ya da kapatılır (eski bağlantı çalışmaz).
--   * Müşteri ve depo ekranları 5 saniyede bir kendiliğinden yenilenir; müşterinin yazdığı firma ve araç bilgileri kayıt altına alınır.
--   * Kimin neyi yaptığı shp_log tablosuna yazılır (Nakliye > Hareketler).
--
-- Önce whatsapp-kurulumu.sql (private.is_editor() için) çalıştırılmış olmalı.
-- Supabase > SQL Editor'de bir kez çalıştırın. Tekrar çalıştırmak zararsızdır (dosya güncellenince yeniden çalıştırılır; kayıtlar korunur).

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

update public.shp_loads set arrived_at = coalesce(arrived_at, updated_at) where status in ('depoda', 'aracta') and arrived_at is null;

-- Yükü depoya getirecek nakliye kamyonunun plakası (müşteri yazar, depo ve operatör görür)
alter table public.shp_loads add column if not exists inbound_plate text not null default '' check (length(inbound_plate) <= 40);

-- Durum çizgisi, beklenen saat, şoför, depo teslim bilgisi (sayım, durum, not, raf) ve etiket (QR) kodu
alter table public.shp_loads add column if not exists assigned_at timestamptz;
alter table public.shp_loads add column if not exists expected_time time;
alter table public.shp_loads add column if not exists driver text not null default '' check (length(driver) <= 80);
alter table public.shp_loads add column if not exists counted_pieces integer check (counted_pieces is null or counted_pieces between 0 and 1000000);
alter table public.shp_loads add column if not exists counted_weight numeric(12, 2) check (counted_weight is null or (counted_weight >= 0 and counted_weight < 10000000));
alter table public.shp_loads add column if not exists condition text not null default '' check (condition in ('', 'saglam', 'eksik', 'hasarli'));
alter table public.shp_loads add column if not exists receive_note text not null default '' check (length(receive_note) <= 500);
alter table public.shp_loads add column if not exists location text not null default '' check (length(location) <= 40);
alter table public.shp_loads add column if not exists qr_code text;
update public.shp_loads set qr_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)) where qr_code is null;
alter table public.shp_loads alter column qr_code set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
alter table public.shp_loads alter column qr_code set not null;
create unique index if not exists shp_loads_qr on public.shp_loads (qr_code);
update public.shp_loads set assigned_at = updated_at where status = 'aracta' and assigned_at is null;
alter table public.shp_trips add column if not exists departed_at timestamptz;
alter table public.shp_trips add column if not exists delivered_at timestamptz;
update public.shp_trips set departed_at = updated_at where status in ('yolda', 'teslim') and departed_at is null;
update public.shp_trips set delivered_at = updated_at where status = 'teslim' and delivered_at is null;
alter table public.shp_customers add column if not exists notify_phone text not null default '' check (length(notify_phone) <= 30);
alter table public.shp_customers add column if not exists notify_events jsonb not null default '{"geldi": true, "yola": true, "teslim": true, "sorun": true, "mesaj": true}'::jsonb;

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
  update public.shp_loads set status = case when arrived_at is null then 'bekliyor' else 'depoda' end, trip_id = null where id = p_load_id;
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
  update public.shp_loads set status = case when arrived_at is null then 'bekliyor' else 'depoda' end, trip_id = null where trip_id = p_trip;
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
    'arrived_by', l.arrived_by, 'trip_id', l.trip_id, 'note', l.note, 'inbound_plate', l.inbound_plate, 'created_at', l.created_at,
    'expected_time', to_char(l.expected_time, 'HH24:MI'), 'driver', l.driver, 'assigned_at', l.assigned_at, 'counted_pieces', l.counted_pieces,
    'counted_weight', l.counted_weight, 'condition', l.condition, 'receive_note', l.receive_note, 'location', l.location, 'qr_code', l.qr_code)
$$;

create or replace function private.shp_customer_json(c public.shp_customers) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('id', c.id, 'name', c.name, 'carrier', c.carrier, 'cmr_notes', c.cmr_notes,
                            'loading_place', c.loading_place, 'logo', c.logo)
$$;

create or replace function public.shp_portal(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k record;
  c public.shp_customers;
begin
  select * into k from private.shp_cust_auth(p_token);
  select * into c from public.shp_customers where id = k.customer_id and active;
  if not found then raise exception 'Bağlantı geçersiz ya da kapatılmış' using errcode = '42501'; end if;
  return jsonb_build_object(
    'now', now(),
    'customer', private.shp_customer_json(c),
    'loads', coalesce((select jsonb_agg(private.shp_load_json(l) order by l.created_at desc)
                       from public.shp_loads l
                       where l.customer_id = c.id
                         and (l.status <> 'aracta' or l.updated_at > now() - interval '120 days')), '[]'::jsonb),
    'trips', coalesce((select jsonb_agg(to_jsonb(t) - 'created_by' - 'updated_by' order by t.created_at desc)
                       from public.shp_trips t where t.customer_id = c.id and t.created_at > now() - interval '120 days'), '[]'::jsonb),
    'photo_counts', coalesce((select jsonb_object_agg(p.load_id, p.n) from (select load_id, count(*) as n from public.shp_photos where customer_id = c.id group by 1) p), '{}'::jsonb),
    'notify', jsonb_build_object('phone', c.notify_phone, 'events', c.notify_events),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'from_role', m.from_role, 'author', case m.from_role when 'ofis' then 'Ofis' when 'depo' then 'Depo' else m.author end, 'body', m.body,
                                                              'load_id', m.load_id, 'trip_id', m.trip_id, 'created_at', m.created_at, 'read_at', m.read_at) order by m.id)
                          from (select * from public.shp_messages where customer_id = c.id order by id desc limit 100) m), '[]'::jsonb),
    'user', case when k.user_id is null then null else (select jsonb_build_object('username', u.username, 'name', coalesce(nullif(u.display_name, ''), u.username)) from public.shp_users u where u.id = k.user_id) end,
    'contacts', coalesce((select jsonb_agg(jsonb_build_object('kind', x.kind, 'name', x.name, 'addr', x.addr, 'notify', x.notify, 'country', x.country,
                                                             'dest_customs', x.dest_customs, 'code', x.code, 'broker', x.broker) order by x.used_at desc)
                          from (select * from public.shp_contacts where customer_id = c.id order by used_at desc limit 300) x), '[]'::jsonb),
    'vehicles', coalesce((select jsonb_agg(jsonb_build_object('tractor', x.tractor, 'trailer', x.trailer) order by x.used_at desc)
                          from (select * from public.shp_vehicles where customer_id = c.id order by used_at desc limit 100) x), '[]'::jsonb),
    'log', coalesce((select jsonb_agg(jsonb_build_object('at', y.at, 'actor', case y.role when 'operator' then 'Ofis' when 'depo' then 'Depo' else y.actor end, 'action', y.action, 'summary', y.summary) order by y.at desc, y.id desc)
                     from (select * from public.shp_log where customer_id = c.id order by at desc, id desc limit 60) y), '[]'::jsonb));
end $$;

-- Metni temizle: boşlukları düzelt, uzunluğu sınırla (shp_ml: satır sonları korunur; adresler için)
create or replace function private.shp_txt(p jsonb, k text, n int) returns text
language sql immutable set search_path = '' as $$
  select left(regexp_replace(btrim(coalesce(p ->> k, '')), '[\r\n\t]+', ' ', 'g'), n)
$$;

create or replace function private.shp_ml(p jsonb, k text, n int) returns text
language sql immutable set search_path = '' as $$
  select left(btrim(replace(coalesce(p ->> k, ''), E'\r', '')), n)
$$;

-- Yük alanlarını temizler ve doğrular: müşteri, depo ve operatör aynı kuralı kullanır (hatalıysa işlem durur)
create or replace function private.shp_clean_load(p jsonb) returns public.shp_loads
language plpgsql immutable set search_path = '' as $$
declare r public.shp_loads;
begin
  r.sender := private.shp_txt(p, 'sender', 200);
  r.consignee := private.shp_txt(p, 'consignee', 200);
  if r.sender = '' or r.consignee = '' then
    raise exception 'Gönderici ve alıcı yazılmalı' using errcode = '22023';
  end if;
  begin
    r.weight := coalesce(nullif(p ->> 'weight', '')::numeric, 0);
    r.volume := nullif(p ->> 'volume', '')::numeric;
    r.pieces := coalesce(nullif(p ->> 'pieces', '')::int, 0);
    r.expected_date := nullif(p ->> 'expected_date', '')::date;
    r.expected_time := nullif(p ->> 'expected_time', '')::time;
  exception when others then
    raise exception 'Kap, kilo, hacim, tarih ya da saat sayı / tarih / saat (örn. 10:30) olarak okunamadı' using errcode = '22023';
  end;
  if r.weight < 0 or r.weight >= 10000000 or r.pieces < 0 or r.pieces > 1000000 or (r.volume is not null and (r.volume < 0 or r.volume >= 1000000)) then
    raise exception 'Kap, kilo ya da hacim aralık dışında' using errcode = '22023';
  end if;
  r.sender_addr := private.shp_ml(p, 'sender_addr', 300);
  r.consignee_addr := private.shp_ml(p, 'consignee_addr', 300);
  r.notify := private.shp_ml(p, 'notify', 300);
  r.packing := coalesce(nullif(private.shp_txt(p, 'packing', 40), ''), 'KAP');
  r.goods := private.shp_txt(p, 'goods', 200);
  r.country := private.shp_txt(p, 'country', 60);
  r.code := private.shp_txt(p, 'code', 40);
  r.dest_customs := private.shp_txt(p, 'dest_customs', 80);
  r.broker := private.shp_txt(p, 'broker', 120);
  r.inbound_plate := upper(private.shp_txt(p, 'inbound_plate', 40));
  r.driver := private.shp_txt(p, 'driver', 80);
  r.note := private.shp_txt(p, 'note', 500);
  return r;
end $$;

-- Müşteri: yük yazar ya da düzenler. Düzenleme: araca konmamış yük (bekleyen / depoda) ya da henüz yola çıkmamış araçtaki yük.
create or replace function public.shp_portal_save(p_token text, p_load jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k record;
  l public.shp_loads;
  c public.shp_loads;
  pid uuid := nullif(p_load ->> 'id', '')::uuid;
begin
  select * into k from private.shp_cust_auth(p_token);
  c := private.shp_clean_load(p_load);
  if pid is null then
    if (select count(*) from public.shp_loads x where x.customer_id = k.customer_id and x.status <> 'aracta') >= 2000 then
      raise exception 'Açık yük sayısı sınırına ulaşıldı' using errcode = '22023';
    end if;
    insert into public.shp_loads (customer_id, sender, sender_addr, consignee, consignee_addr, notify, pieces, packing, goods, weight, volume,
                                  country, code, dest_customs, broker, expected_date, expected_time, driver, inbound_plate, note, created_by)
    values (k.customer_id, c.sender, c.sender_addr, c.consignee, c.consignee_addr, c.notify, c.pieces, c.packing, c.goods, c.weight, c.volume,
            c.country, c.code, c.dest_customs, c.broker, c.expected_date, c.expected_time, c.driver, c.inbound_plate, c.note, 'Müşteri')
    returning * into l;
  else
    update public.shp_loads x set sender = c.sender, sender_addr = c.sender_addr, consignee = c.consignee, consignee_addr = c.consignee_addr,
      notify = c.notify, pieces = c.pieces, packing = c.packing, goods = c.goods, weight = c.weight, volume = c.volume, country = c.country,
      code = c.code, dest_customs = c.dest_customs, broker = c.broker, expected_date = c.expected_date, expected_time = c.expected_time, driver = c.driver,
      inbound_plate = c.inbound_plate, note = c.note
    where x.id = pid and x.customer_id = k.customer_id
      and ((x.status in ('bekliyor', 'depoda') and x.trip_id is null)
           or (x.status = 'aracta' and exists (select 1 from public.shp_trips t where t.id = x.trip_id and t.status = 'hazirlaniyor')))
    returning * into l;
    if not found then raise exception 'Yük bulunamadı ya da araç yola çıktığı için değiştirilemez' using errcode = '22023'; end if;
  end if;
  return private.shp_load_json(l);
end $$;

-- Müşteri: yük siler (araca konmamış olmalı; araçtaki yükü önce araçtan çıkarır)
create or replace function public.shp_portal_delete(p_token text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare k record;
begin
  select * into k from private.shp_cust_auth(p_token);
  delete from public.shp_loads where id = p_id and customer_id = k.customer_id and status in ('bekliyor', 'depoda') and trip_id is null;
  if not found then raise exception 'Yük bulunamadı ya da araca konduğu için silinemez; önce araçtan çıkarın' using errcode = '22023'; end if;
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
    'trips', coalesce((select jsonb_agg(to_jsonb(t) - 'created_by' - 'updated_by' order by t.created_at desc)
                       from public.shp_trips t where t.created_at > now() - interval '30 days'), '[]'::jsonb),
    'photo_counts', coalesce((select jsonb_object_agg(p.load_id, p.n) from (select load_id, count(*) as n from public.shp_photos group by 1) p), '{}'::jsonb),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'customer_id', m.customer_id, 'from_role', m.from_role, 'author', case m.from_role when 'ofis' then 'Ofis' else m.author end, 'body', m.body,
                                                              'load_id', m.load_id, 'trip_id', m.trip_id, 'created_at', m.created_at, 'read_at', m.read_at) order by m.id)
                          from (select * from public.shp_messages where customer_id is not null order by id desc limit 500) m), '[]'::jsonb));
end $$;

create or replace function public.shp_depot_mark(p_token text, p_id uuid, p_arrived boolean, p_name text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k record;
  l public.shp_loads;
begin
  select * into k from private.shp_depot_auth(p_token, p_name);
  -- Araçtaki yük de işaretlenir: durumu "aracta" kalır, yalnızca geliş saati yazılır / silinir
  if coalesce(p_arrived, true) then
    update public.shp_loads set status = case when status = 'aracta' then 'aracta' else 'depoda' end,
      arrived_at = now(), arrived_by = left(btrim(coalesce(p_name, '')), 120)
    where id = p_id and status in ('bekliyor', 'depoda', 'aracta') returning * into l;
  else
    update public.shp_loads set status = case when status = 'aracta' then 'aracta' else 'bekliyor' end, arrived_at = null, arrived_by = ''
    where id = p_id and status in ('depoda', 'aracta') and arrived_at is not null returning * into l;
  end if;
  if not found then raise exception 'Yük bulunamadı ya da bu işlem artık yapılamaz' using errcode = '22023'; end if;
  return private.shp_load_json(l);
end $$;

-- Depo: yükün bilgisini düzeltir (gerçek kap / kilo gibi) ya da siler (araca konmamış olmalı); işlemi yapanın adı kayda geçer
drop function if exists public.shp_depot_save(text, jsonb);
drop function if exists public.shp_depot_delete(text, uuid);
create or replace function public.shp_depot_save(p_token text, p_load jsonb, p_name text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k record;
  l public.shp_loads;
  c public.shp_loads;
  pid uuid := nullif(p_load ->> 'id', '')::uuid;
begin
  select * into k from private.shp_depot_auth(p_token, p_name);
  if pid is null then raise exception 'Yük bulunamadı' using errcode = '22023'; end if;
  c := private.shp_clean_load(p_load);
  update public.shp_loads x set sender = c.sender, sender_addr = c.sender_addr, consignee = c.consignee, consignee_addr = c.consignee_addr,
    notify = c.notify, pieces = c.pieces, packing = c.packing, goods = c.goods, weight = c.weight, volume = c.volume, country = c.country,
    code = c.code, dest_customs = c.dest_customs, broker = c.broker, expected_date = c.expected_date, expected_time = c.expected_time, driver = c.driver,
    inbound_plate = c.inbound_plate, note = c.note
  where x.id = pid returning * into l;
  if not found then raise exception 'Yük bulunamadı' using errcode = '22023'; end if;
  return private.shp_load_json(l);
end $$;

create or replace function public.shp_depot_delete(p_token text, p_id uuid, p_name text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare k record;
begin
  select * into k from private.shp_depot_auth(p_token, p_name);
  delete from public.shp_loads where id = p_id and status in ('bekliyor', 'depoda') and trip_id is null;
  if not found then raise exception 'Yük bulunamadı ya da araca konduğu için silinemez; önce araçtan çıkarılmalı' using errcode = '22023'; end if;
end $$;

-- ---------------------------------------------------------------- müşteri: yüklerini araçlara yerleştirir
-- p_trip boşsa yeni sefer açılır (çekici plaka gerekli, Poz No otomatik); doluysa müşterinin kendi seferine eklenir.
create or replace function public.shp_portal_assign(p_token text, p_load_ids uuid[], p_trip uuid default null, p_tractor text default '',
                                                     p_trailer text default '', p_depart date default null, p_subject text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k record;
  t public.shp_trips;
  n int;
begin
  select * into k from private.shp_cust_auth(p_token);
  if p_load_ids is null or coalesce(array_length(p_load_ids, 1), 0) = 0 then
    raise exception 'Önce yük seçin' using errcode = '22023';
  end if;
  if array_length(p_load_ids, 1) > 300 then raise exception 'Bir seferde en fazla 300 yük' using errcode = '22023'; end if;
  select count(*) into n from (
    select l.id from public.shp_loads l
    where l.id = any (p_load_ids) and l.customer_id = k.customer_id and l.status in ('bekliyor', 'depoda') and l.trip_id is null
    for update
  ) x;
  if n <> (select count(distinct i) from unnest(p_load_ids) i) then
    raise exception 'Seçilen yüklerden bazıları artık araca konamaz (başka araçta ya da silinmiş); listeyi yenileyip tekrar seçin' using errcode = '22023';
  end if;
  if p_trip is not null then
    select * into t from public.shp_trips where id = p_trip and customer_id = k.customer_id for update;
    if not found then raise exception 'Araç bulunamadı' using errcode = '22023'; end if;
    if t.status <> 'hazirlaniyor' then raise exception 'Bu araç yola çıktı, değişiklik için ofisle görüşün' using errcode = '22023'; end if;
  else
    if btrim(coalesce(p_tractor, '')) = '' then raise exception 'Çekici plakası gerekli' using errcode = '22023'; end if;
    insert into public.shp_trips (poz_no, customer_id, tractor, trailer, depart_date, subject, created_by)
    values (private.shp_next_poz(), k.customer_id, upper(left(btrim(p_tractor), 30)), upper(left(btrim(coalesce(p_trailer, '')), 30)),
            coalesce(p_depart, (now() at time zone 'Europe/Istanbul')::date), left(btrim(coalesce(p_subject, '')), 200), 'Müşteri')
    returning * into t;
  end if;
  update public.shp_loads set status = 'aracta', trip_id = t.id where id = any (p_load_ids);
  return jsonb_build_object('trip', to_jsonb(t) - 'created_by' - 'updated_by');
end $$;

create or replace function public.shp_portal_unassign(p_token text, p_load_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k record;
  tid uuid;
  gone boolean := false;
begin
  select * into k from private.shp_cust_auth(p_token);
  select l.trip_id into tid from public.shp_loads l
  join public.shp_trips t on t.id = l.trip_id
  where l.id = p_load_id and l.customer_id = k.customer_id and l.status = 'aracta' and t.status = 'hazirlaniyor' for update of l;
  if tid is null then raise exception 'Yük bir araçta değil ya da araç yola çıktığı için değiştirilemez' using errcode = '22023'; end if;
  update public.shp_loads set status = case when arrived_at is null then 'bekliyor' else 'depoda' end, trip_id = null where id = p_load_id;
  if not exists (select 1 from public.shp_loads l where l.trip_id = tid) then
    delete from public.shp_trips where id = tid;
    gone := true;
  end if;
  return jsonb_build_object('trip_deleted', gone);
end $$;

create or replace function public.shp_portal_trip_update(p_token text, p_trip uuid, p_tractor text, p_trailer text default '',
                                                          p_depart date default null, p_subject text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k record;
  t public.shp_trips;
begin
  select * into k from private.shp_cust_auth(p_token);
  if btrim(coalesce(p_tractor, '')) = '' then raise exception 'Çekici plakası gerekli' using errcode = '22023'; end if;
  update public.shp_trips set tractor = upper(left(btrim(p_tractor), 30)), trailer = upper(left(btrim(coalesce(p_trailer, '')), 30)),
    depart_date = coalesce(p_depart, depart_date), subject = left(btrim(coalesce(p_subject, '')), 200)
  where id = p_trip and customer_id = k.customer_id and status = 'hazirlaniyor' returning * into t;
  if not found then raise exception 'Araç bulunamadı ya da yola çıktığı için değiştirilemez' using errcode = '22023'; end if;
  return to_jsonb(t) - 'created_by' - 'updated_by';
end $$;

-- ---------------------------------------------------------------- kullanıcılar, giriş, işlem geçmişi, kayıtlı firma ve araçlar
-- Müşteri tarafı kullanıcı adı ve şifreyle giriş: kullanıcıları ve şifreleri siz belirlersiniz (Nakliye > Müşteriler > Kullanıcılar).
-- Bir müşteriye kullanıcı eklediğiniz anda o müşterinin sayfası yalnızca kullanıcı girişiyle açılır (bağlantı tek başına yetmez;
-- kullanıcılar pasif olsa bile bağlantı açılmaz, ancak tüm kullanıcılar silinirse bağlantıyla girişe dönülür).
-- Her yük ve sefer işlemi (kim, ne zaman, ne yaptı) shp_log tablosuna yazılır; Nakliye > Hareketler'de görürsünüz.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter table public.shp_loads add column if not exists updated_by text not null default '' check (length(updated_by) <= 120);
alter table public.shp_trips add column if not exists updated_by text not null default '' check (length(updated_by) <= 120);

create table if not exists public.shp_users (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.shp_customers (id) on delete cascade,
  username text not null check (username ~ '^[a-z0-9._-]{3,40}$'),
  display_name text not null default '' check (length(display_name) <= 80),
  active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists shp_users_username on public.shp_users (username);
create table if not exists private.shp_user_pw (user_id uuid primary key references public.shp_users (id) on delete cascade, pass_hash text not null);
create table if not exists private.shp_sessions (
  token text primary key, user_id uuid not null references public.shp_users (id) on delete cascade,
  created_at timestamptz not null default now(), expires_at timestamptz not null
);
create table if not exists private.shp_attempts (username text primary key, fails int not null default 0, locked_until timestamptz, updated_at timestamptz not null default now());

create table if not exists public.shp_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  customer_id uuid,
  actor text not null default '',
  role text not null default '',
  action text not null,
  summary text not null default ''
);
create index if not exists shp_log_at on public.shp_log (at desc);
create index if not exists shp_log_musteri on public.shp_log (customer_id, at desc);

-- Müşterinin bir kez yazdığı firma (gönderici / alıcı) ve araç bilgileri kendiliğinden saklanır; sonraki yüklerde tekrar yazılmaz
create table if not exists public.shp_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.shp_customers (id) on delete cascade,
  kind text not null check (kind in ('sender', 'consignee')),
  name text not null,
  addr text not null default '',
  notify text not null default '',
  country text not null default '',
  dest_customs text not null default '',
  code text not null default '',
  broker text not null default '',
  used_at timestamptz not null default now()
);
create unique index if not exists shp_contacts_tek on public.shp_contacts (customer_id, kind, upper(name));
create table if not exists public.shp_vehicles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.shp_customers (id) on delete cascade,
  tractor text not null,
  trailer text not null default '',
  used_at timestamptz not null default now()
);
create unique index if not exists shp_vehicles_tek on public.shp_vehicles (customer_id, tractor, trailer);

alter table public.shp_users enable row level security;
alter table public.shp_log enable row level security;
alter table public.shp_contacts enable row level security;
alter table public.shp_vehicles enable row level security;
revoke all on public.shp_users, public.shp_log, public.shp_contacts, public.shp_vehicles from anon;
revoke all on private.shp_user_pw, private.shp_sessions, private.shp_attempts from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.shp_users, public.shp_log, public.shp_contacts, public.shp_vehicles from authenticated';
    execute 'revoke all on private.shp_user_pw, private.shp_sessions, private.shp_attempts from authenticated';
    execute 'grant select on public.shp_log to authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on private.shp_user_pw, private.shp_sessions, private.shp_attempts from anon'; end if;
end $$;
-- işlem geçmişini yalnızca düzenleyiciler okur
drop policy if exists shp_log_editor on public.shp_log;
create policy shp_log_editor on public.shp_log for select to authenticated using ((select private.is_editor()));

-- şifre özeti (bcrypt) ve doğrulama; pgcrypto hangi şemada kuruluysa orayı kullanır
create or replace function private.shp_hash(pw text) returns text
language plpgsql set search_path = '' as $$
declare sch text; r text;
begin
  select n.nspname into sch from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgcrypto';
  if sch is null then raise exception 'pgcrypto kurulu değil' using errcode = '55000'; end if;
  execute format('select %1$I.crypt($1, %1$I.gen_salt(''bf'', 10))', sch) into r using pw;
  return r;
end $$;
create or replace function private.shp_check(pw text, h text) returns boolean
language plpgsql set search_path = '' as $$
declare sch text; ok boolean;
begin
  select n.nspname into sch from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgcrypto';
  if sch is null then raise exception 'pgcrypto kurulu değil' using errcode = '55000'; end if;
  execute format('select %I.crypt($1, $2) = $2', sch) into ok using pw, h;
  return coalesce(ok, false);
end $$;

-- işlemi yapan: müşteri / depo işlevleri adı "pcs.actor" ayarına yazar; yoksa oturum açan düzenleyicinin e-postası
create or replace function private.shp_actor() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(current_setting('pcs.actor', true), ''), nullif(btrim(coalesce(auth.jwt() ->> 'email', '')), ''), 'Operatör')
$$;
create or replace function private.shp_role_of(a text) returns text
language sql immutable set search_path = '' as $$ select case when a like 'Müşteri%' then 'musteri' when a like 'Depo%' then 'depo' else 'operator' end $$;

-- müşteri sayfası yetkisi: oturum anahtarı (kullanıcı girişi) ya da müşteri bağlantısı (müşteriye kullanıcı tanımlıysa giriş zorunlu)
create or replace function private.shp_cust_auth(p_token text) returns table (customer_id uuid, user_id uuid, actor text)
language plpgsql security definer set search_path = '' as $$
declare u record; k private.shp_links; a text;
begin
  select us.id as uid, us.customer_id as cid, us.username as un, us.display_name as dn into u
  from private.shp_sessions s join public.shp_users us on us.id = s.user_id join public.shp_customers c on c.id = us.customer_id
  where s.token = p_token and s.expires_at > now() and us.active and c.active;
  if found then
    a := 'Müşteri · ' || coalesce(nullif(u.dn, ''), u.un);
    perform set_config('pcs.actor', a, true);
    return query select u.cid, u.uid, a;
    return;
  end if;
  select * into k from private.shp_links l where l.token = p_token and l.kind = 'musteri' and l.active;
  if not found then raise exception 'Bağlantı geçersiz ya da kapatılmış' using errcode = '42501'; end if;
  if exists (select 1 from public.shp_users su where su.customer_id = k.customer_id) then
    raise exception 'Bu sayfa için kullanıcı girişi gerekli' using errcode = '28000';
  end if;
  perform set_config('pcs.actor', 'Müşteri (bağlantı)', true);
  return query select k.customer_id, null::uuid, 'Müşteri (bağlantı)'::text;
end $$;

create or replace function private.shp_depot_auth(p_token text, p_name text default '') returns table (actor text)
language plpgsql security definer set search_path = '' as $$
declare k private.shp_links; a text;
begin
  select * into k from private.shp_links l where l.token = p_token and l.kind = 'depo' and l.active;
  if not found then raise exception 'Bağlantı geçersiz ya da kapatılmış' using errcode = '42501'; end if;
  a := 'Depo · ' || coalesce(nullif(left(btrim(coalesce(p_name, '')), 60), ''), 'adı yazılmamış');
  perform set_config('pcs.actor', a, true);
  return query select a;
end $$;

-- yük ve seferlerde kim oluşturdu / son kim değiştirdi
create or replace function private.shp_stamp_actor() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then new.created_by := left(private.shp_actor(), 120); end if;
  new.updated_by := left(private.shp_actor(), 120);
  return new;
end $$;
drop trigger if exists shp_loads_actor on public.shp_loads;
create trigger shp_loads_actor before insert or update on public.shp_loads for each row execute function private.shp_stamp_actor();
drop trigger if exists shp_trips_actor on public.shp_trips;
create trigger shp_trips_actor before insert or update on public.shp_trips for each row execute function private.shp_stamp_actor();

-- işlem geçmişi: yük
create or replace function private.shp_log_load() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a text := private.shp_actor(); act text; r public.shp_loads;
begin
  if tg_op = 'DELETE' then r := old; act := 'Yük silindi';
  elsif tg_op = 'INSERT' then r := new; act := 'Yük eklendi';
  else
    r := new;
    if old.arrived_at is null and new.arrived_at is not null then
      act := 'Depoya geldi olarak işaretlendi' || case new.condition when 'eksik' then ' (eksik var)' when 'hasarli' then ' (hasarlı)' else '' end;
    elsif old.arrived_at is not null and new.arrived_at is null then act := 'Geldi işareti geri alındı';
    elsif old.trip_id is distinct from new.trip_id then
      if new.trip_id is null then act := 'Araçtan çıkarıldı';
      else act := 'Araca konuldu: ' || coalesce((select t.poz_no || ' · ' || t.tractor from public.shp_trips t where t.id = new.trip_id), ''); end if;
    elsif (old.sender, old.consignee, old.sender_addr, old.consignee_addr, old.notify, old.pieces, old.packing, old.goods, old.weight, old.volume,
           old.country, old.code, old.dest_customs, old.broker, old.expected_date, old.expected_time, old.driver, old.inbound_plate, old.note)
          is distinct from
          (new.sender, new.consignee, new.sender_addr, new.consignee_addr, new.notify, new.pieces, new.packing, new.goods, new.weight, new.volume,
           new.country, new.code, new.dest_customs, new.broker, new.expected_date, new.expected_time, new.driver, new.inbound_plate, new.note)
    then act := 'Yük düzenlendi';
    elsif (old.counted_pieces, old.counted_weight, old.condition, old.receive_note, old.location)
          is distinct from (new.counted_pieces, new.counted_weight, new.condition, new.receive_note, new.location)
    then act := 'Depo teslim bilgisi girildi' || case new.condition when 'eksik' then ' (eksik var)' when 'hasarli' then ' (hasarlı)' else '' end;
    else return null; end if;
  end if;
  insert into public.shp_log (customer_id, actor, role, action, summary)
  values (r.customer_id, a, private.shp_role_of(a), act, r.sender || ' → ' || r.consignee || ' · ' || r.weight || ' kg');
  return null;
end $$;
drop trigger if exists shp_loads_log on public.shp_loads;
create trigger shp_loads_log after insert or update or delete on public.shp_loads for each row execute function private.shp_log_load();

-- işlem geçmişi: sefer
create or replace function private.shp_log_trip() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a text := private.shp_actor(); act text; r public.shp_trips;
begin
  if tg_op = 'DELETE' then r := old; act := 'Sefer silindi';
  elsif tg_op = 'INSERT' then r := new; act := 'Sefer oluşturuldu';
  else
    r := new;
    if old.status is distinct from new.status then act := case when new.status = 'hazirlaniyor' then 'Sefer kilidi açıldı' else 'Sefer kilitlendi (yola çıktı)' end;
    elsif (old.tractor, old.trailer, old.depart_date, old.subject) is distinct from (new.tractor, new.trailer, new.depart_date, new.subject) then act := 'Araç bilgisi değiştirildi';
    else return null; end if;
  end if;
  insert into public.shp_log (customer_id, actor, role, action, summary)
  values (r.customer_id, a, private.shp_role_of(a), act, r.poz_no || ' · ' || r.tractor || case when r.trailer <> '' then ' / ' || r.trailer else '' end);
  return null;
end $$;
drop trigger if exists shp_trips_log on public.shp_trips;
create trigger shp_trips_log after insert or update or delete on public.shp_trips for each row execute function private.shp_log_trip();

-- firma ve araç bilgisini kendiliğinden sakla
create or replace function private.shp_remember_load() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if btrim(new.sender) <> '' then
    insert into public.shp_contacts (customer_id, kind, name, addr, used_at) values (new.customer_id, 'sender', new.sender, new.sender_addr, now())
    on conflict (customer_id, kind, (upper(name))) do update set addr = case when excluded.addr <> '' then excluded.addr else public.shp_contacts.addr end, used_at = now();
  end if;
  if btrim(new.consignee) <> '' then
    insert into public.shp_contacts (customer_id, kind, name, addr, notify, country, dest_customs, code, broker, used_at)
    values (new.customer_id, 'consignee', new.consignee, new.consignee_addr, new.notify, new.country, new.dest_customs, new.code, new.broker, now())
    on conflict (customer_id, kind, (upper(name))) do update set
      addr = case when excluded.addr <> '' then excluded.addr else public.shp_contacts.addr end,
      notify = case when excluded.notify <> '' then excluded.notify else public.shp_contacts.notify end,
      country = case when excluded.country <> '' then excluded.country else public.shp_contacts.country end,
      dest_customs = case when excluded.dest_customs <> '' then excluded.dest_customs else public.shp_contacts.dest_customs end,
      code = case when excluded.code <> '' then excluded.code else public.shp_contacts.code end,
      broker = case when excluded.broker <> '' then excluded.broker else public.shp_contacts.broker end,
      used_at = now();
  end if;
  return null;
end $$;
drop trigger if exists shp_loads_remember on public.shp_loads;
create trigger shp_loads_remember after insert or update of sender, consignee, sender_addr, consignee_addr, notify, country, dest_customs, code, broker on public.shp_loads
  for each row execute function private.shp_remember_load();
create or replace function private.shp_remember_trip() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if btrim(new.tractor) <> '' then
    insert into public.shp_vehicles (customer_id, tractor, trailer, used_at) values (new.customer_id, new.tractor, new.trailer, now())
    on conflict (customer_id, tractor, trailer) do update set used_at = now();
  end if;
  return null;
end $$;
drop trigger if exists shp_trips_remember on public.shp_trips;
create trigger shp_trips_remember after insert or update of tractor, trailer on public.shp_trips for each row execute function private.shp_remember_trip();

-- şimdiye kadarki kayıtlardan rehberi doldur (tekrar çalıştırmak zararsızdır)
insert into public.shp_contacts (customer_id, kind, name, addr, used_at)
select distinct on (l.customer_id, upper(l.sender)) l.customer_id, 'sender', l.sender, l.sender_addr, l.created_at
from public.shp_loads l where btrim(l.sender) <> '' order by l.customer_id, upper(l.sender), (l.sender_addr <> '') desc, l.created_at desc
on conflict do nothing;
insert into public.shp_contacts (customer_id, kind, name, addr, notify, country, dest_customs, code, broker, used_at)
select distinct on (l.customer_id, upper(l.consignee)) l.customer_id, 'consignee', l.consignee, l.consignee_addr, l.notify, l.country, l.dest_customs, l.code, l.broker, l.created_at
from public.shp_loads l where btrim(l.consignee) <> '' order by l.customer_id, upper(l.consignee), (l.consignee_addr <> '') desc, l.created_at desc
on conflict do nothing;
insert into public.shp_vehicles (customer_id, tractor, trailer, used_at)
select distinct on (t.customer_id, t.tractor, t.trailer) t.customer_id, t.tractor, t.trailer, t.created_at
from public.shp_trips t where btrim(t.tractor) <> '' order by t.customer_id, t.tractor, t.trailer, t.created_at desc
on conflict do nothing;

-- kullanıcı girişi: 5 yanlış denemede 15 dakika kilit. Hata fırlatmaz, {ok:false} döner; böylece deneme sayacı geri alınmaz.
create or replace function public.shp_login(p_username text, p_password text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  un text := lower(btrim(coalesce(p_username, '')));
  at private.shp_attempts;
  u record;
  ok boolean := false;
  found_user boolean := false;
  tok text;
  nm text;
  nf int;
begin
  select * into at from private.shp_attempts a where a.username = left(un, 60);
  if found and at.locked_until is not null and at.locked_until > now() then
    return jsonb_build_object('ok', false, 'message', 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.');
  end if;
  select us.id as uid, us.customer_id as cid, us.username as uname, us.display_name as dn, h.pass_hash as hash into u
  from public.shp_users us join private.shp_user_pw h on h.user_id = us.id join public.shp_customers c on c.id = us.customer_id
  where us.username = un and us.active and c.active;
  found_user := found;
  if found_user then ok := private.shp_check(coalesce(p_password, ''), u.hash);
  else perform private.shp_hash(coalesce(p_password, 'x')); end if;   -- kullanıcı yokken de aynı sürede cevap ver
  if not ok then
    nf := case when at.updated_at is not null and at.updated_at < now() - interval '15 minutes' then 1 else coalesce(at.fails, 0) + 1 end;
    insert into private.shp_attempts (username, fails, locked_until, updated_at) values (left(un, 60), nf, case when nf >= 5 then now() + interval '15 minutes' end, now())
    on conflict (username) do update set fails = excluded.fails, locked_until = excluded.locked_until, updated_at = now();
    return jsonb_build_object('ok', false, 'message', 'Kullanıcı adı ya da şifre hatalı.');
  end if;
  delete from private.shp_attempts a where a.username = left(un, 60);
  delete from private.shp_sessions s where s.expires_at < now();
  delete from private.shp_attempts a where a.updated_at < now() - interval '1 day';
  delete from public.shp_log g where g.at < now() - interval '400 days';
  tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into private.shp_sessions (token, user_id, expires_at) values (tok, u.uid, now() + interval '30 days');
  update public.shp_users set last_login_at = now() where id = u.uid;
  nm := coalesce(nullif(u.dn, ''), u.uname);
  insert into public.shp_log (customer_id, actor, role, action) values (u.cid, 'Müşteri · ' || nm, 'musteri', 'Giriş yaptı');
  return jsonb_build_object('ok', true, 'token', tok, 'name', nm, 'username', u.uname);
end $$;

create or replace function public.shp_logout(p_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from private.shp_sessions where token = p_token;
end $$;

-- hafif değişiklik damgası: açık ekranlar 5 saniyede bir bunu sorar, değiştiyse tam veriyi çeker
create or replace function public.shp_stamp(p_token text) returns text
language plpgsql security definer set search_path = '' as $$
declare k record; cid uuid; isdepot boolean := false; r text;
begin
  begin
    select * into k from private.shp_cust_auth(p_token);
    cid := k.customer_id;
  exception when sqlstate '28000' then
    raise;
  when others then
    perform 1 from private.shp_links l where l.token = p_token and l.kind = 'depo' and l.active;
    if not found then raise exception 'Bağlantı geçersiz ya da kapatılmış' using errcode = '42501'; end if;
    isdepot := true;
  end;
  select (select count(*)::text || '/' || coalesce(max(l.updated_at)::text, '') from public.shp_loads l where isdepot or l.customer_id = cid) || '|' ||
         (select count(*)::text || '/' || coalesce(max(t.updated_at)::text, '') from public.shp_trips t where isdepot or t.customer_id = cid) || '|' ||
         (select count(*)::text || '/' || coalesce(max(m.id)::text, '') || '/' || count(m.read_at)::text from public.shp_messages m where case when isdepot then m.customer_id is not null else m.customer_id = cid end) into r;
  return r;
end $$;

-- düzenleyici: kullanıcı yönetimi
create or replace function public.shp_users_list(p_customer uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce((select private.is_editor()), false) then raise exception 'Bu işlem için düzenleyici yetkisi gerekli' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'customer_id', u.customer_id, 'customer', c.name, 'username', u.username, 'display_name', u.display_name,
                                                     'active', u.active, 'last_login_at', u.last_login_at) order by c.name, u.username)
                   from public.shp_users u join public.shp_customers c on c.id = u.customer_id where p_customer is null or u.customer_id = p_customer), '[]'::jsonb);
end $$;

create or replace function public.shp_user_save(p_id uuid, p_customer uuid, p_username text, p_name text, p_password text, p_active boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  un text := lower(btrim(coalesce(p_username, '')));
  pw text := coalesce(p_password, '');
  r public.shp_users;
begin
  if not coalesce((select private.is_editor()), false) then raise exception 'Bu işlem için düzenleyici yetkisi gerekli' using errcode = '42501'; end if;
  if un !~ '^[a-z0-9._-]{3,40}$' then raise exception 'Kullanıcı adı 3-40 karakter olmalı; küçük harf, rakam, nokta, tire ya da alt çizgi kullanın' using errcode = '22023'; end if;
  if p_id is null then
    if length(pw) < 6 then raise exception 'Şifre en az 6 karakter olmalı' using errcode = '22023'; end if;
    insert into public.shp_users (customer_id, username, display_name, active) values (p_customer, un, left(btrim(coalesce(p_name, '')), 80), coalesce(p_active, true)) returning * into r;
    insert into private.shp_user_pw (user_id, pass_hash) values (r.id, private.shp_hash(pw));
    insert into public.shp_log (customer_id, actor, role, action, summary) values (r.customer_id, private.shp_actor(), 'operator', 'Kullanıcı eklendi', un);
  else
    if pw <> '' and length(pw) < 6 then raise exception 'Şifre en az 6 karakter olmalı' using errcode = '22023'; end if;
    update public.shp_users set username = un, display_name = left(btrim(coalesce(p_name, '')), 80), active = coalesce(p_active, true), updated_at = now()
    where id = p_id returning * into r;
    if not found then raise exception 'Kullanıcı bulunamadı' using errcode = '22023'; end if;
    if pw <> '' then
      insert into private.shp_user_pw (user_id, pass_hash) values (r.id, private.shp_hash(pw)) on conflict (user_id) do update set pass_hash = excluded.pass_hash;
    end if;
    if pw <> '' or not r.active then delete from private.shp_sessions where user_id = r.id; end if;
    insert into public.shp_log (customer_id, actor, role, action, summary)
    values (r.customer_id, private.shp_actor(), 'operator', case when pw <> '' then 'Kullanıcı şifresi değiştirildi' else 'Kullanıcı güncellendi' end, un);
  end if;
  return jsonb_build_object('id', r.id, 'username', r.username, 'display_name', r.display_name, 'active', r.active);
exception when unique_violation then
  raise exception 'Bu kullanıcı adı başka biri tarafından kullanılıyor' using errcode = '22023';
end $$;

create or replace function public.shp_user_delete(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.shp_users;
begin
  if not coalesce((select private.is_editor()), false) then raise exception 'Bu işlem için düzenleyici yetkisi gerekli' using errcode = '42501'; end if;
  delete from public.shp_users where id = p_id returning * into r;
  if found then insert into public.shp_log (customer_id, actor, role, action, summary) values (r.customer_id, private.shp_actor(), 'operator', 'Kullanıcı silindi', r.username); end if;
end $$;

-- düzenleyici: işlem geçmişi (müşteriye göre süzülebilir)
create or replace function public.shp_log_list(p_customer uuid default null, p_limit int default 200) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce((select private.is_editor()), false) then raise exception 'Bu işlem için düzenleyici yetkisi gerekli' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('at', y.at, 'customer_id', y.customer_id, 'customer', c.name, 'actor', y.actor, 'role', y.role, 'action', y.action, 'summary', y.summary) order by y.at desc, y.id desc)
                   from (select * from public.shp_log g where p_customer is null or g.customer_id = p_customer order by g.at desc, g.id desc limit least(greatest(coalesce(p_limit, 200), 1), 500)) y
                   left join public.shp_customers c on c.id = y.customer_id), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------- yeni özellikler: durum zamanları, bildirim kuyruğu, depo teslim bilgisi ve fotoğraf, yazışma, toplu yükleme, rapor
-- Durum çizgisi: yük "araca kondu" ve sefer "yola çıktı / teslim" zamanları kendiliğinden yazılır.
create or replace function private.shp_load_times() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.trip_id is distinct from old.trip_id then
    new.assigned_at := case when new.trip_id is null then null else now() end;
  end if;
  return new;
end $$;
drop trigger if exists shp_loads_times on public.shp_loads;
create trigger shp_loads_times before update on public.shp_loads for each row execute function private.shp_load_times();

create or replace function private.shp_trip_times() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'yolda' then
      new.departed_at := now(); new.delivered_at := null;
    elsif new.status = 'teslim' then
      new.delivered_at := now(); new.departed_at := coalesce(new.departed_at, old.departed_at, now());
    else
      new.departed_at := null; new.delivered_at := null;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists shp_trips_times on public.shp_trips;
create trigger shp_trips_times before update on public.shp_trips for each row execute function private.shp_trip_times();

-- Fotoğraflar (depo yükü teslim alırken çeker; küçük resim + sıkıştırılmış resim yazı olarak saklanır)
create table if not exists public.shp_photos (
  id uuid primary key default gen_random_uuid(),
  load_id uuid not null references public.shp_loads (id) on delete cascade,
  customer_id uuid not null references public.shp_customers (id) on delete cascade,
  thumb text not null check (length(thumb) <= 60000 and thumb ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$'),
  data text not null check (length(data) <= 500000 and data ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$'),
  by_name text not null default '' check (length(by_name) <= 120),
  created_at timestamptz not null default now()
);
create index if not exists shp_photos_yuk on public.shp_photos (load_id, created_at);

-- Ofisle yazışma
create table if not exists public.shp_messages (
  id bigint generated always as identity primary key,
  customer_id uuid references public.shp_customers (id) on delete cascade,
  channel text not null default 'musteri',                                    -- hep musteri (müşteri ile depo yazışması; ofis de görür ve yazabilir)
  from_role text not null check (from_role in ('musteri', 'ofis', 'depo')),
  author text not null default '',
  body text not null check (length(btrim(body)) between 1 and 1000),
  load_id uuid references public.shp_loads (id) on delete set null,
  trip_id uuid references public.shp_trips (id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
-- Daha önce çalıştırılmış kurulumlarda tablo genişletilir (from_role artık depo da olabilir)
alter table public.shp_messages add column if not exists channel text not null default 'musteri';
alter table public.shp_messages alter column customer_id drop not null;
alter table public.shp_messages drop constraint if exists shp_messages_from_role_check;
alter table public.shp_messages add constraint shp_messages_from_role_check check (from_role in ('musteri', 'ofis', 'depo'));
alter table public.shp_messages drop constraint if exists shp_messages_channel_check;
alter table public.shp_messages add constraint shp_messages_channel_check check (channel in ('musteri', 'depo') and (channel = 'depo' or customer_id is not null));
drop index if exists public.shp_messages_depo;
create index if not exists shp_messages_musteri on public.shp_messages (customer_id, id desc);

-- Bildirim kuyruğu: depoya geldi, yola çıktı, teslim, sorun, ofis mesajı. Gönderim: sunucu fonksiyonu nakliye-bildirim (WhatsApp, kendiliğinden) ya da ofiste tek tıkla.
create table if not exists public.shp_outbox (
  id bigint generated always as identity primary key,
  customer_id uuid not null references public.shp_customers (id) on delete cascade,
  event text not null check (event in ('geldi', 'yola', 'teslim', 'sorun', 'mesaj')),
  phone text not null,
  body text not null,
  status text not null default 'bekliyor' check (status in ('bekliyor', 'gonderiliyor', 'gonderildi', 'hata', 'iptal')),
  error text not null default '',
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists shp_outbox_durum on public.shp_outbox (status, created_at);
-- Daha önce çalıştırılmış kurulumlarda durum denetimine 'gonderiliyor' eklenir
alter table public.shp_outbox drop constraint if exists shp_outbox_status_check;
alter table public.shp_outbox add constraint shp_outbox_status_check check (status in ('bekliyor', 'gonderiliyor', 'gonderildi', 'hata', 'iptal'));

alter table public.shp_photos enable row level security;
alter table public.shp_messages enable row level security;
alter table public.shp_outbox enable row level security;
revoke all on public.shp_photos, public.shp_messages, public.shp_outbox from anon;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.shp_photos, public.shp_messages, public.shp_outbox from authenticated';
    execute 'grant select, delete on public.shp_photos to authenticated';
    execute 'grant select, insert, update, delete on public.shp_messages to authenticated';
    execute 'grant select, update, delete on public.shp_outbox to authenticated';
  end if;
end $$;
drop policy if exists shp_photos_editor on public.shp_photos;
create policy shp_photos_editor on public.shp_photos for all to authenticated using ((select private.is_editor())) with check ((select private.is_editor()));
drop policy if exists shp_messages_editor on public.shp_messages;
create policy shp_messages_editor on public.shp_messages for all to authenticated using ((select private.is_editor())) with check ((select private.is_editor()));
drop policy if exists shp_outbox_editor on public.shp_outbox;
create policy shp_outbox_editor on public.shp_outbox for all to authenticated using ((select private.is_editor())) with check ((select private.is_editor()));

-- Mesajı yazanı kayda geçir (ofis düzenleyicisi: e-posta; müşteri: kullanıcı adı)
create or replace function private.shp_message_author() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.author := left(case when new.from_role = 'ofis' then 'Ofis' else private.shp_actor() end, 120);
  return new;
end $$;
drop trigger if exists shp_messages_author on public.shp_messages;
create trigger shp_messages_author before insert on public.shp_messages for each row execute function private.shp_message_author();

-- Bildirimi kuyruğa ekle: müşterinin numarası yoksa ya da o haberi kapatmışsa eklenmez
create or replace function private.shp_enqueue(p_customer uuid, p_event text, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.shp_customers;
begin
  select * into c from public.shp_customers x where x.id = p_customer;
  if not found or btrim(c.notify_phone) = '' or coalesce(c.notify_events ->> p_event, 'true') <> 'true' then return; end if;
  insert into public.shp_outbox (customer_id, event, phone, body) values (p_customer, p_event, c.notify_phone, left(p_body, 500));
end $$;

-- Kuyruğa haber eklenince WhatsApp gönderen sunucu fonksiyonu (nakliye-bildirim) çağrılır; fonksiyon henüz kurulmadıysa ya da
-- çağrı yapılamazsa hiçbir şey olmaz, haber ofisteki Bildirimler sekmesinde elle gönderilmeyi bekler. Asıl işlem (Geldi vb.) asla bozulmaz.
do $$ begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net kurulamadı (%): bildirimler yalnızca ofisteki Bildirimler sekmesinden gönderilir.', sqlerrm;
end $$;
create or replace function private.shp_outbox_ping() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  begin
    perform net.http_post(url := 'https://ollrccfqiqilbflanuik.supabase.co/functions/v1/nakliye-bildirim',
                          headers := '{"Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb, timeout_milliseconds := 5000);
  exception when others then
    null;
  end;
  return null;
end $$;
revoke all on function private.shp_outbox_ping() from public, anon, authenticated;
drop trigger if exists shp_outbox_ping on public.shp_outbox;
create trigger shp_outbox_ping after insert on public.shp_outbox for each statement execute function private.shp_outbox_ping();

create or replace function private.shp_notify_load() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.arrived_at is null and new.arrived_at is not null then
    perform private.shp_enqueue(new.customer_id, 'geldi', new.sender || ' → ' || new.consignee || ' · ' || new.pieces || ' kap · ' || trim_scale(new.weight) || ' kg');
  end if;
  return null;
end $$;
drop trigger if exists shp_loads_notify on public.shp_loads;
create trigger shp_loads_notify after update on public.shp_loads for each row execute function private.shp_notify_load();

create or replace function private.shp_notify_trip() returns trigger
language plpgsql security definer set search_path = '' as $$
declare txt text := new.tractor || case when new.trailer <> '' then ' / ' || new.trailer else '' end || ' · ' || new.poz_no;
begin
  if old.status is distinct from new.status then
    if new.status = 'yolda' then perform private.shp_enqueue(new.customer_id, 'yola', txt);
    elsif new.status = 'teslim' then perform private.shp_enqueue(new.customer_id, 'teslim', txt); end if;
  end if;
  return null;
end $$;
drop trigger if exists shp_trips_notify on public.shp_trips;
create trigger shp_trips_notify after update on public.shp_trips for each row execute function private.shp_notify_trip();

create or replace function private.shp_notify_message() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.from_role in ('ofis', 'depo') and new.customer_id is not null then
    perform private.shp_enqueue(new.customer_id, 'mesaj', left((case when new.from_role = 'depo' then 'Depo: ' else 'Ofis: ' end) || new.body, 200));
  end if;
  return null;
end $$;
drop trigger if exists shp_messages_notify on public.shp_messages;
create trigger shp_messages_notify after insert on public.shp_messages for each row execute function private.shp_notify_message();

-- Müşteri: bildirim numarası ve hangi haberleri alacağı
create or replace function public.shp_portal_notify_save(p_token text, p_phone text, p_events jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k record;
  ph text := left(regexp_replace(btrim(coalesce(p_phone, '')), '[^0-9+() -]', '', 'g'), 30);
  ev jsonb;
  key text;
  c public.shp_customers;
begin
  select * into k from private.shp_cust_auth(p_token);
  if ph <> '' and length(regexp_replace(ph, '[^0-9]', '', 'g')) not between 10 and 15 then
    raise exception 'Telefon numarasını ülke ya da alan koduyla yazın (örn. +90 5xx xxx xx xx)' using errcode = '22023';
  end if;
  select x.notify_events into ev from public.shp_customers x where x.id = k.customer_id;
  if jsonb_typeof(p_events) = 'object' then
    foreach key in array array['geldi', 'yola', 'teslim', 'sorun', 'mesaj'] loop
      if p_events ? key and jsonb_typeof(p_events -> key) = 'boolean' then ev := jsonb_set(ev, array[key], p_events -> key); end if;
    end loop;
  end if;
  update public.shp_customers set notify_phone = ph, notify_events = ev where id = k.customer_id returning * into c;
  insert into public.shp_log (customer_id, actor, role, action) values (k.customer_id, private.shp_actor(), 'musteri', 'Bildirim ayarı değiştirildi');
  return jsonb_build_object('phone', c.notify_phone, 'events', c.notify_events);
end $$;

-- Müşteri: ofise mesaj yazar / okundu der
create or replace function public.shp_portal_message_send(p_token text, p_body text, p_load uuid default null, p_trip uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k record;
  b text := left(btrim(replace(coalesce(p_body, ''), E'\r', '')), 1000);
  m public.shp_messages;
  lid uuid := p_load;
  tid uuid := p_trip;
begin
  select * into k from private.shp_cust_auth(p_token);
  if b = '' then raise exception 'Mesaj boş olamaz' using errcode = '22023'; end if;
  if (select count(*) from public.shp_messages x where x.customer_id = k.customer_id and x.from_role = 'musteri' and x.created_at > now() - interval '1 minute') >= 10 then
    raise exception 'Çok sık mesaj gönderiyorsunuz; bir dakika sonra tekrar deneyin' using errcode = '22023';
  end if;
  if lid is not null and not exists (select 1 from public.shp_loads x where x.id = lid and x.customer_id = k.customer_id) then lid := null; end if;
  if tid is not null and not exists (select 1 from public.shp_trips x where x.id = tid and x.customer_id = k.customer_id) then tid := null; end if;
  insert into public.shp_messages (customer_id, from_role, body, load_id, trip_id) values (k.customer_id, 'musteri', b, lid, tid) returning * into m;
  return jsonb_build_object('id', m.id, 'from_role', m.from_role, 'author', m.author, 'body', m.body, 'load_id', m.load_id, 'trip_id', m.trip_id, 'created_at', m.created_at, 'read_at', m.read_at);
end $$;

create or replace function public.shp_portal_messages_read(p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare k record;
begin
  select * into k from private.shp_cust_auth(p_token);
  update public.shp_messages set read_at = now() where customer_id = k.customer_id and from_role in ('ofis', 'depo') and read_at is null;
end $$;

-- Depo: bir müşteriye mesaj yazar / o müşterinin mesajlarını okundu yapar (müşteri ile depo yazışır)
drop function if exists public.shp_depot_message_send(text, text, text);
drop function if exists public.shp_depot_messages_read(text, text);
create or replace function public.shp_depot_message_send(p_token text, p_name text, p_customer uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  b text := left(btrim(replace(coalesce(p_body, ''), E'\r', '')), 1000);
  m public.shp_messages;
begin
  perform private.shp_depot_auth(p_token, p_name);
  if b = '' then raise exception 'Mesaj boş olamaz' using errcode = '22023'; end if;
  if not exists (select 1 from public.shp_customers c where c.id = p_customer and c.active) then raise exception 'Müşteri bulunamadı' using errcode = '22023'; end if;
  if (select count(*) from public.shp_messages x where x.customer_id = p_customer and x.from_role = 'depo' and x.created_at > now() - interval '1 minute') >= 15 then
    raise exception 'Çok sık mesaj gönderiyorsunuz; bir dakika sonra tekrar deneyin' using errcode = '22023';
  end if;
  insert into public.shp_messages (customer_id, from_role, body) values (p_customer, 'depo', b) returning * into m;
  return jsonb_build_object('id', m.id, 'customer_id', m.customer_id, 'from_role', m.from_role, 'author', m.author, 'body', m.body, 'load_id', null, 'trip_id', null, 'created_at', m.created_at, 'read_at', m.read_at);
end $$;

create or replace function public.shp_depot_messages_read(p_token text, p_name text, p_customer uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.shp_depot_auth(p_token, p_name);
  update public.shp_messages set read_at = now() where customer_id = p_customer and from_role = 'musteri' and read_at is null;
end $$;

-- Müşteri: Excel'den toplu yük (hepsi ya da hiçbiri; en çok 200 satır)
create or replace function public.shp_portal_import(p_token text, p_loads jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k record;
  e jsonb;
  c public.shp_loads;
  n int := 0;
  w int;
begin
  select * into k from private.shp_cust_auth(p_token);
  if jsonb_typeof(p_loads) <> 'array' or jsonb_array_length(p_loads) not between 1 and 200 then
    raise exception 'Bir seferde 1 ile 200 arası satır eklenebilir' using errcode = '22023';
  end if;
  w := jsonb_array_length(p_loads);
  if (select count(*) from public.shp_loads x where x.customer_id = k.customer_id and x.status <> 'aracta') + w > 2000 then
    raise exception 'Açık yük sayısı sınırına ulaşıldı' using errcode = '22023';
  end if;
  for e in select value from jsonb_array_elements(p_loads) loop
    n := n + 1;
    begin
      c := private.shp_clean_load(e);
    exception when others then
      raise exception 'Satır %: %', n, sqlerrm using errcode = '22023';
    end;
    insert into public.shp_loads (customer_id, sender, sender_addr, consignee, consignee_addr, notify, pieces, packing, goods, weight, volume,
                                  country, code, dest_customs, broker, expected_date, expected_time, driver, inbound_plate, note, created_by)
    values (k.customer_id, c.sender, c.sender_addr, c.consignee, c.consignee_addr, c.notify, c.pieces, c.packing, c.goods, c.weight, c.volume,
            c.country, c.code, c.dest_customs, c.broker, c.expected_date, c.expected_time, c.driver, c.inbound_plate, c.note, 'Müşteri');
  end loop;
  return jsonb_build_object('count', n);
end $$;

-- Müşteri: rapor (haftalık / aylık ağırlık, en çok yük giden alıcılar, göstergeler) ve sefer arşivi
create or replace function public.shp_portal_report(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k record;
  tz constant text := 'Europe/Istanbul';
  today_d date := (now() at time zone tz)::date;
  m0 date := date_trunc('month', now() at time zone tz)::date;
  pm0 date := (date_trunc('month', now() at time zone tz) - interval '1 month')::date;
begin
  select * into k from private.shp_cust_auth(p_token);
  return jsonb_build_object(
    'weeks', coalesce((select jsonb_agg(jsonb_build_object('start', s.w, 'kg', s.kg, 'loads', s.n) order by s.w)
                       from (select (date_trunc('week', l.created_at at time zone tz))::date as w, sum(l.weight) as kg, count(*) as n
                             from public.shp_loads l where l.customer_id = k.customer_id and l.created_at > now() - interval '60 days'
                             group by 1 order by 1 desc limit 8) s), '[]'::jsonb),
    'months', coalesce((select jsonb_agg(jsonb_build_object('start', s.w, 'kg', s.kg, 'loads', s.n) order by s.w)
                        from (select (date_trunc('month', l.created_at at time zone tz))::date as w, sum(l.weight) as kg, count(*) as n
                              from public.shp_loads l where l.customer_id = k.customer_id and l.created_at > now() - interval '13 months'
                              group by 1 order by 1 desc limit 12) s), '[]'::jsonb),
    'top', coalesce((select jsonb_agg(jsonb_build_object('name', s.nm, 'kg', s.kg, 'loads', s.n) order by s.kg desc)
                     from (select upper(l.consignee) as nm, sum(l.weight) as kg, count(*) as n
                           from public.shp_loads l where l.customer_id = k.customer_id and l.created_at > now() - interval '120 days'
                           group by 1 order by 3 desc, 2 desc limit 8) s), '[]'::jsonb),
    'kpi', jsonb_build_object(
      'month_loads', (select count(*) from public.shp_loads l where l.customer_id = k.customer_id and (l.created_at at time zone tz)::date >= m0),
      'month_kg', (select coalesce(sum(l.weight), 0) from public.shp_loads l where l.customer_id = k.customer_id and (l.created_at at time zone tz)::date >= m0),
      'prev_loads', (select count(*) from public.shp_loads l where l.customer_id = k.customer_id and (l.created_at at time zone tz)::date >= pm0 and (l.created_at at time zone tz)::date < m0),
      'prev_kg', (select coalesce(sum(l.weight), 0) from public.shp_loads l where l.customer_id = k.customer_id and (l.created_at at time zone tz)::date >= pm0 and (l.created_at at time zone tz)::date < m0),
      'month_trips', (select count(*) from public.shp_trips t where t.customer_id = k.customer_id and t.depart_date >= m0),
      'avg_fill', (select round(avg(s.kg) / 24000 * 100) from (select sum(l.weight) as kg from public.shp_loads l join public.shp_trips t on t.id = l.trip_id
                    where t.customer_id = k.customer_id and t.depart_date >= m0 group by t.id) s),
      'avg_days', (select round(avg(extract(epoch from (t.delivered_at - t.departed_at)) / 86400)::numeric, 1) from public.shp_trips t
                   where t.customer_id = k.customer_id and t.delivered_at is not null and t.departed_at is not null and t.delivered_at > now() - interval '120 days')),
    'archive', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'poz_no', s.poz_no, 'tractor', s.tractor, 'trailer', s.trailer, 'depart_date', s.depart_date,
                                                           'status', s.status, 'loads', s.n, 'kg', s.kg) order by s.created_at desc)
                         from (select t.*, (select count(*) from public.shp_loads l where l.trip_id = t.id) as n,
                                      (select coalesce(sum(l.weight), 0) from public.shp_loads l where l.trip_id = t.id) as kg
                               from public.shp_trips t where t.customer_id = k.customer_id order by t.created_at desc limit 120) s), '[]'::jsonb),
    'today', today_d);
end $$;

-- Müşteri: arşivdeki seferin yükleri (ana listede olmayan eski seferler için; belgeler bununla hazırlanır)
create or replace function public.shp_portal_trip_docs(p_token text, p_trip uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k record;
  t public.shp_trips;
begin
  select * into k from private.shp_cust_auth(p_token);
  select * into t from public.shp_trips x where x.id = p_trip and x.customer_id = k.customer_id;
  if not found then raise exception 'Sefer bulunamadı' using errcode = '22023'; end if;
  return jsonb_build_object('trip', to_jsonb(t) - 'created_by' - 'updated_by',
    'loads', coalesce((select jsonb_agg(private.shp_load_json(l) order by l.created_at) from public.shp_loads l where l.trip_id = t.id), '[]'::jsonb));
end $$;

-- Fotoğraflar: müşteri kendi yüklerinin, depo her yükün fotoğrafını görür; yalnızca depo ekler / siler
create or replace function public.shp_portal_photos(p_token text, p_load uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k record;
begin
  select * into k from private.shp_cust_auth(p_token);
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'thumb', p.thumb, 'by', p.by_name, 'at', p.created_at) order by p.created_at)
                   from public.shp_photos p where p.load_id = p_load and p.customer_id = k.customer_id), '[]'::jsonb);
end $$;

create or replace function public.shp_portal_photo(p_token text, p_photo uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare k record; d text;
begin
  select * into k from private.shp_cust_auth(p_token);
  select p.data into d from public.shp_photos p where p.id = p_photo and p.customer_id = k.customer_id;
  if not found then raise exception 'Fotoğraf bulunamadı' using errcode = '22023'; end if;
  return d;
end $$;

create or replace function public.shp_depot_photos(p_token text, p_load uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k record;
begin
  select * into k from private.shp_depot_auth(p_token, '');
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'thumb', p.thumb, 'by', p.by_name, 'at', p.created_at) order by p.created_at)
                   from public.shp_photos p where p.load_id = p_load), '[]'::jsonb);
end $$;

create or replace function public.shp_depot_photo(p_token text, p_photo uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare k record; d text;
begin
  select * into k from private.shp_depot_auth(p_token, '');
  select p.data into d from public.shp_photos p where p.id = p_photo;
  if not found then raise exception 'Fotoğraf bulunamadı' using errcode = '22023'; end if;
  return d;
end $$;

create or replace function public.shp_depot_photo_add(p_token text, p_load uuid, p_name text, p_thumb text, p_data text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k record;
  l public.shp_loads;
  p public.shp_photos;
begin
  select * into k from private.shp_depot_auth(p_token, p_name);
  select * into l from public.shp_loads x where x.id = p_load;
  if not found then raise exception 'Yük bulunamadı' using errcode = '22023'; end if;
  if (select count(*) from public.shp_photos x where x.load_id = p_load) >= 8 then
    raise exception 'Bir yüke en fazla 8 fotoğraf eklenebilir' using errcode = '22023';
  end if;
  begin
    insert into public.shp_photos (load_id, customer_id, thumb, data, by_name)
    values (p_load, l.customer_id, p_thumb, p_data, left(btrim(coalesce(p_name, '')), 120)) returning * into p;
  exception when check_violation then
    raise exception 'Fotoğraf geçersiz ya da çok büyük' using errcode = '22023';
  end;
  update public.shp_loads set updated_at = now() where id = p_load;
  insert into public.shp_log (customer_id, actor, role, action, summary) values (l.customer_id, private.shp_actor(), 'depo', 'Fotoğraf eklendi', l.sender || ' → ' || l.consignee);
  return jsonb_build_object('id', p.id, 'thumb', p.thumb, 'by', p.by_name, 'at', p.created_at);
end $$;

create or replace function public.shp_depot_photo_del(p_token text, p_photo uuid, p_name text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare k record; l public.shp_loads;
begin
  select * into k from private.shp_depot_auth(p_token, p_name);
  select x.* into l from public.shp_loads x join public.shp_photos p on p.load_id = x.id where p.id = p_photo;
  if not found then return; end if;
  delete from public.shp_photos where id = p_photo;
  update public.shp_loads set updated_at = now() where id = l.id;
end $$;

-- Depo: yükü teslim alır (sayım, durum, not, raf konumu); sorun varsa müşteriye bildirim kuyruğa girer
create or replace function public.shp_depot_receive(p_token text, p_id uuid, p_name text default '', p_counted_pieces int default null,
                                                     p_counted_weight numeric default null, p_condition text default 'saglam',
                                                     p_note text default '', p_location text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k record;
  l public.shp_loads;
  cond text := coalesce(nullif(btrim(p_condition), ''), 'saglam');
  msg text;
begin
  select * into k from private.shp_depot_auth(p_token, p_name);
  if cond not in ('saglam', 'eksik', 'hasarli') then raise exception 'Durum seçimi geçersiz' using errcode = '22023'; end if;
  if p_counted_pieces is not null and (p_counted_pieces < 0 or p_counted_pieces > 1000000) then raise exception 'Sayılan kap aralık dışında' using errcode = '22023'; end if;
  if p_counted_weight is not null and (p_counted_weight < 0 or p_counted_weight >= 10000000) then raise exception 'Tartılan kilo aralık dışında' using errcode = '22023'; end if;
  update public.shp_loads x set
    status = case when x.status = 'aracta' then 'aracta' else 'depoda' end,
    arrived_at = coalesce(x.arrived_at, now()),
    arrived_by = case when x.arrived_at is null then left(btrim(coalesce(p_name, '')), 120) else x.arrived_by end,
    counted_pieces = p_counted_pieces, counted_weight = p_counted_weight, condition = cond,
    receive_note = left(btrim(replace(coalesce(p_note, ''), E'\r', '')), 500), location = left(btrim(coalesce(p_location, '')), 40)
  where x.id = p_id and x.status in ('bekliyor', 'depoda', 'aracta') returning * into l;
  if not found then raise exception 'Yük bulunamadı ya da bu işlem artık yapılamaz' using errcode = '22023'; end if;
  if cond in ('eksik', 'hasarli') or (l.counted_pieces is not null and l.counted_pieces <> l.pieces) then
    msg := l.sender || ' → ' || l.consignee || ': ' ||
      concat_ws(', ',
        case when cond = 'eksik' then 'eksik var' when cond = 'hasarli' then 'hasarlı' end,
        case when l.counted_pieces is not null and l.counted_pieces <> l.pieces then 'beyan ' || l.pieces || ' kap, sayılan ' || l.counted_pieces || ' kap' end,
        nullif(l.receive_note, ''));
    perform private.shp_enqueue(l.customer_id, 'sorun', msg);
  end if;
  return private.shp_load_json(l);
end $$;

-- Depo: araç yola çıkar (yalnızca tüm yükler depoya gelmişse); kilitler, müşteri artık değiştiremez
create or replace function public.shp_depot_depart(p_token text, p_trip uuid, p_name text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k record;
  t public.shp_trips;
begin
  select * into k from private.shp_depot_auth(p_token, p_name);
  select * into t from public.shp_trips x where x.id = p_trip for update;
  if not found then raise exception 'Sefer bulunamadı' using errcode = '22023'; end if;
  if t.status <> 'hazirlaniyor' then raise exception 'Bu araç zaten yola çıkmış' using errcode = '22023'; end if;
  if not exists (select 1 from public.shp_loads l where l.trip_id = t.id) then raise exception 'Araçta yük yok' using errcode = '22023'; end if;
  if exists (select 1 from public.shp_loads l where l.trip_id = t.id and l.arrived_at is null) then
    raise exception 'Depoya gelmemiş yük var; hepsi gelmeden araç yola çıkarılamaz (ofisle görüşün)' using errcode = '22023';
  end if;
  update public.shp_trips set status = 'yolda' where id = t.id returning * into t;
  return to_jsonb(t) - 'created_by' - 'updated_by';
end $$;

-- ---------------------------------------------------------------- yetkiler
revoke all on function public.shp_assign(uuid, uuid[], text, text, date, text), public.shp_unassign(uuid), public.shp_delete_trip(uuid),
  public.shp_links(), public.shp_rotate_link(uuid), public.shp_set_link(uuid, boolean),
  public.shp_portal(text), public.shp_portal_save(text, jsonb), public.shp_portal_delete(text, uuid),
  public.shp_depot(text), public.shp_depot_mark(text, uuid, boolean, text),
  public.shp_portal_assign(text, uuid[], uuid, text, text, date, text), public.shp_portal_unassign(text, uuid),
  public.shp_portal_trip_update(text, uuid, text, text, date, text), public.shp_depot_save(text, jsonb, text), public.shp_depot_delete(text, uuid, text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.shp_assign(uuid, uuid[], text, text, date, text), public.shp_unassign(uuid), public.shp_delete_trip(uuid), public.shp_links(), public.shp_rotate_link(uuid), public.shp_set_link(uuid, boolean) from anon';
    execute 'grant execute on function public.shp_portal(text), public.shp_portal_save(text, jsonb), public.shp_portal_delete(text, uuid), public.shp_depot(text), public.shp_depot_mark(text, uuid, boolean, text), public.shp_portal_assign(text, uuid[], uuid, text, text, date, text), public.shp_portal_unassign(text, uuid), public.shp_portal_trip_update(text, uuid, text, text, date, text), public.shp_depot_save(text, jsonb, text), public.shp_depot_delete(text, uuid, text) to anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.shp_assign(uuid, uuid[], text, text, date, text), public.shp_unassign(uuid), public.shp_delete_trip(uuid), public.shp_links(), public.shp_rotate_link(uuid), public.shp_set_link(uuid, boolean) to authenticated';
    execute 'grant execute on function public.shp_portal(text), public.shp_portal_save(text, jsonb), public.shp_portal_delete(text, uuid), public.shp_depot(text), public.shp_depot_mark(text, uuid, boolean, text), public.shp_portal_assign(text, uuid[], uuid, text, text, date, text), public.shp_portal_unassign(text, uuid), public.shp_portal_trip_update(text, uuid, text, text, date, text), public.shp_depot_save(text, jsonb, text), public.shp_depot_delete(text, uuid, text) to authenticated';
  end if;
end $$;

-- yeni işlevlerin yetkileri: giriş / çıkış / değişiklik damgası herkese açık (anahtar ister); kullanıcı ve geçmiş yönetimi yalnızca düzenleyicilere
revoke all on function public.shp_login(text, text), public.shp_logout(text), public.shp_stamp(text),
  public.shp_users_list(uuid), public.shp_user_save(uuid, uuid, text, text, text, boolean), public.shp_user_delete(uuid),
  public.shp_log_list(uuid, int) from public;
revoke all on function private.shp_hash(text), private.shp_check(text, text), private.shp_actor(), private.shp_role_of(text),
  private.shp_cust_auth(text), private.shp_depot_auth(text, text), private.shp_stamp_actor(), private.shp_log_load(), private.shp_log_trip(),
  private.shp_remember_load(), private.shp_remember_trip() from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.shp_users_list(uuid), public.shp_user_save(uuid, uuid, text, text, text, boolean), public.shp_user_delete(uuid), public.shp_log_list(uuid, int) from anon';
    execute 'grant execute on function public.shp_login(text, text), public.shp_logout(text), public.shp_stamp(text) to anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.shp_login(text, text), public.shp_logout(text), public.shp_stamp(text), public.shp_users_list(uuid), public.shp_user_save(uuid, uuid, text, text, text, boolean), public.shp_user_delete(uuid), public.shp_log_list(uuid, int) to authenticated';
  end if;
end $$;

-- durum çizgisi, bildirim, toplu yükleme, rapor, fotoğraf, teslim alma, yola çıkarma, yazışma işlevlerinin yetkileri
revoke all on function public.shp_portal_notify_save(text, text, jsonb), public.shp_portal_message_send(text, text, uuid, uuid), public.shp_portal_messages_read(text),
  public.shp_depot_message_send(text, text, uuid, text), public.shp_depot_messages_read(text, text, uuid),
  public.shp_portal_import(text, jsonb), public.shp_portal_report(text), public.shp_portal_trip_docs(text, uuid), public.shp_portal_photos(text, uuid), public.shp_portal_photo(text, uuid),
  public.shp_depot_photos(text, uuid), public.shp_depot_photo(text, uuid), public.shp_depot_photo_add(text, uuid, text, text, text), public.shp_depot_photo_del(text, uuid, text),
  public.shp_depot_receive(text, uuid, text, int, numeric, text, text, text), public.shp_depot_depart(text, uuid, text) from public;
revoke all on function private.shp_load_times(), private.shp_trip_times(), private.shp_message_author(), private.shp_enqueue(uuid, text, text),
  private.shp_notify_load(), private.shp_notify_trip(), private.shp_notify_message() from public;
do $$ declare fl text := 'public.shp_portal_notify_save(text, text, jsonb), public.shp_portal_message_send(text, text, uuid, uuid), public.shp_portal_messages_read(text), public.shp_portal_import(text, jsonb), public.shp_portal_report(text), public.shp_portal_trip_docs(text, uuid), public.shp_portal_photos(text, uuid), public.shp_portal_photo(text, uuid), public.shp_depot_photos(text, uuid), public.shp_depot_photo(text, uuid), public.shp_depot_photo_add(text, uuid, text, text, text), public.shp_depot_photo_del(text, uuid, text), public.shp_depot_receive(text, uuid, text, int, numeric, text, text, text), public.shp_depot_depart(text, uuid, text), public.shp_depot_message_send(text, text, uuid, text), public.shp_depot_messages_read(text, text, uuid)'; begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'grant execute on function ' || fl || ' to anon'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'grant execute on function ' || fl || ' to authenticated'; end if;
end $$;

-- ---------------------------------------------------------------- anlık güncelleme: müşteri yük yazınca / depo "Geldi" deyince açık ekran hemen yenilenir
do $$ declare t text; begin
  foreach t in array array['shp_loads', 'shp_trips', 'shp_messages', 'shp_outbox'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------- PLASTNAK müşterisi: Lade Liste ve CMR taslağı (logo, nakliyeci bilgisi, şartlar)
-- Panodaki PLASTNAK müşterisi varsa (adında PLASTNAK geçen) boş kalan alanları doldurur, yoksa PLASTNAK adıyla ekler.
-- Elle yazdığınız bilgilerin üzerine yazmaz: yalnızca boş (ya da hazır varsayılan şart metni olan) alanlar doldurulur.
do $plastnak$
declare
  cid uuid;
  c_info constant text := E'RO: +40 (770) 984 922- TR: +90 (532) 782 29 29\nMAİL: info@plastnakinternational.com\nWEB SİTEMİZ: www.plastnakinternational.com';
  c_notes constant text := E'This carriage is subject,notwithstanding any clauseto the convention on the contract for the International carriage of oods by road(CMR)\n* Aracınıza yüklenen mallar ambalaj ve yükleme hatakarından dolayı meydana gelecek hasarlardanfirmamız sorumlu değildir.\n* Malın sigortasından firmamız sorumlu değildir.\n* Kaza anında firmamız hiçbir mesuliyet kabul etmez.\n* Bu hamule senedi gönderenin beyanına göre tanzim edilmiştir.\ngöderenin beyan dışındaki fazla veya eksik ve kanun dışı yüklenen mallardan firmamız sorumlu değildir.';
  c_logo constant text := 'data:image/png;base64,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';
begin
  select id into cid from public.shp_customers where upper(name) like '%PLASTNAK%' order by created_at limit 1;
  if cid is null then
    insert into public.shp_customers (name, carrier, cmr_notes, loading_place, logo) values ('PLASTNAK', c_info, c_notes, 'İSTANBUL - Turkey', c_logo);
  else
    update public.shp_customers set
      carrier = case when btrim(carrier) = '' then c_info else carrier end,
      cmr_notes = case when btrim(cmr_notes) = '' or cmr_notes like '* Aracınıza yüklenen mallar ambalaj ve yükleme hatalarından%' then c_notes else cmr_notes end,
      logo = case when logo = '' then c_logo else logo end
    where id = cid;
  end if;
end $plastnak$;

-- ---------------------------------------------------------------- kontrol: on dört satır da "tamam" olmalı
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
                 and to_regprocedure('public.shp_links()') is not null then 'tamam' else 'EKSİK' end
union all
select 'müşteri araç planı',
       case when to_regprocedure('public.shp_portal_assign(text, uuid[], uuid, text, text, date, text)') is not null
                 and to_regprocedure('public.shp_portal_unassign(text, uuid)') is not null
                 and to_regprocedure('public.shp_portal_trip_update(text, uuid, text, text, date, text)') is not null then 'tamam' else 'EKSİK' end
union all
select 'yük düzenleme, silme ve getirecek kamyon plakası',
       case when to_regprocedure('public.shp_depot_save(text, jsonb, text)') is not null and to_regprocedure('public.shp_depot_delete(text, uuid, text)') is not null
                 and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'shp_loads' and column_name = 'inbound_plate')
            then 'tamam' else 'EKSİK' end
union all
select 'PLASTNAK taslağı (logo, nakliyeci bilgisi)',
       case when exists (select 1 from public.shp_customers where upper(name) like '%PLASTNAK%' and logo <> '') then 'tamam' else 'EKSİK' end
union all
select 'müşteri kullanıcı girişi (kullanıcı adı ve şifre)',
       case when to_regclass('public.shp_users') is not null and to_regclass('private.shp_user_pw') is not null
                 and to_regprocedure('public.shp_login(text, text)') is not null and to_regprocedure('public.shp_user_save(uuid, uuid, text, text, text, boolean)') is not null
                 and exists (select 1 from pg_extension where extname = 'pgcrypto') then 'tamam' else 'EKSİK' end
union all
select 'işlem geçmişi (kim ne yaptı)',
       case when to_regclass('public.shp_log') is not null and to_regprocedure('public.shp_log_list(uuid, int)') is not null
                 and exists (select 1 from pg_trigger where tgrelid = 'public.shp_loads'::regclass and tgname = 'shp_loads_log')
                 and exists (select 1 from pg_trigger where tgrelid = 'public.shp_trips'::regclass and tgname = 'shp_trips_log') then 'tamam' else 'EKSİK' end
union all
select 'firma ve araç bilgisi kendiliğinden kaydı, 5 sn yenileme',
       case when to_regclass('public.shp_contacts') is not null and to_regclass('public.shp_vehicles') is not null
                 and to_regprocedure('public.shp_stamp(text)') is not null
                 and exists (select 1 from pg_trigger where tgrelid = 'public.shp_loads'::regclass and tgname = 'shp_loads_remember') then 'tamam' else 'EKSİK' end
union all
select 'durum çizgisi ve bildirim kuyruğu',
       case when to_regclass('public.shp_outbox') is not null and to_regprocedure('public.shp_portal_notify_save(text, text, jsonb)') is not null
                 and exists (select 1 from pg_trigger where tgrelid = 'public.shp_trips'::regclass and tgname = 'shp_trips_notify')
                 and exists (select 1 from pg_trigger where tgrelid = 'public.shp_outbox'::regclass and tgname = 'shp_outbox_ping')
                 and exists (select 1 from pg_trigger where tgrelid = 'public.shp_trips'::regclass and tgname = 'shp_trips_times')
                 and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'shp_trips' and column_name = 'delivered_at') then 'tamam' else 'EKSİK' end
union all
select 'Excel''den toplu yükleme ve rapor',
       case when to_regprocedure('public.shp_portal_import(text, jsonb)') is not null and to_regprocedure('public.shp_portal_report(text)') is not null
                 and to_regprocedure('public.shp_portal_trip_docs(text, uuid)') is not null then 'tamam' else 'EKSİK' end
union all
select 'depoda teslim alma, fotoğraf, QR kodu ve yola çıkarma kontrolü',
       case when to_regclass('public.shp_photos') is not null and to_regprocedure('public.shp_depot_receive(text, uuid, text, int, numeric, text, text, text)') is not null
                 and to_regprocedure('public.shp_depot_depart(text, uuid, text)') is not null
                 and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'shp_loads' and column_name = 'qr_code') then 'tamam' else 'EKSİK' end
union all
select 'müşteri ile depo yazışması',
       case when to_regclass('public.shp_messages') is not null and to_regprocedure('public.shp_portal_message_send(text, text, uuid, uuid)') is not null
                 and to_regprocedure('public.shp_depot_message_send(text, text, uuid, text)') is not null
                 and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'shp_messages' and column_name = 'channel')
                 and exists (select 1 from pg_trigger where tgrelid = 'public.shp_messages'::regclass and tgname = 'shp_messages_notify') then 'tamam' else 'EKSİK' end;
