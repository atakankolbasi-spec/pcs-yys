-- WhatsApp'tan otomatik ruhsat aktarma: veritabanı kurulumu.
--
-- WhatsApp numarasına gelen her ruhsat fotoğrafı "whatsapp-webhook" sunucu fonksiyonu tarafından
-- "ruhsat-gelen" deposuna kaydedilir ve bu tabloya bir satır eklenir. Panonun açık olduğu bir
-- düzenleyici bilgisayarı fotoğrafı tarayıcıda okur:
--   * plaka kayıtlarında çekici + dorse çifti varsa araç panoya otomatik eklenir,
--   * yoksa "Ruhsattan ekle" penceresinde kontrol bekler.
--
-- Supabase > SQL Editor'de bir kez çalıştırın. Tekrar çalıştırmak zararsızdır.

create table if not exists public.incoming_ruhsat (
  id uuid primary key default gen_random_uuid(),
  wa_message_id text not null unique,          -- aynı mesaj iki kez gelirse ikinci kayıt açılmaz
  from_number text not null default '',        -- gönderenin numarası (905321234567 biçiminde)
  sender_name text not null default '',        -- gönderenin WhatsApp'taki adı
  caption text not null default '',            -- fotoğrafın altına yazılan not
  media_path text,                             -- depodaki dosya; 60 gün sonra silinir ve boşaltılır
  mime text not null default '',
  status text not null default 'yeni'
    check (status in ('yeni', 'okunuyor', 'bekliyor', 'eklendi', 'mevcut', 'yoksayildi')),
  claimed_at timestamptz,                      -- okumayı üstlenen ekran ve zamanı (iki ekran aynı
  claimed_by uuid,                             -- fotoğrafı aynı anda okumasın diye)
  tractor text not null default '',            -- okunan plakalar ve boş ağırlıklar
  trailer text not null default '',
  weights integer[] not null default '{}',
  fuzzy boolean not null default false,
  note text not null default '',
  plate text not null default '',              -- panoya eklenen plaka
  visit_id text,
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists incoming_ruhsat_acik on public.incoming_ruhsat (created_at)
  where status in ('yeni', 'okunuyor', 'bekliyor');

create or replace function public.incoming_ruhsat_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists incoming_ruhsat_touch on public.incoming_ruhsat;
create trigger incoming_ruhsat_touch before update on public.incoming_ruhsat
  for each row execute function public.incoming_ruhsat_touch();

-- Yetki: yalnızca düzenleyiciler görür ve günceller. Satırı yalnızca sunucu fonksiyonu ekler
-- (gizli anahtarla çalıştığı için bu kurallara takılmaz). Kimse silemez.
alter table public.incoming_ruhsat enable row level security;
revoke all on public.incoming_ruhsat from anon;
grant select, update on public.incoming_ruhsat to authenticated;

drop policy if exists incoming_ruhsat_editor_read on public.incoming_ruhsat;
create policy incoming_ruhsat_editor_read on public.incoming_ruhsat
  for select to authenticated using ((select private.is_editor()));

drop policy if exists incoming_ruhsat_editor_update on public.incoming_ruhsat;
create policy incoming_ruhsat_editor_update on public.incoming_ruhsat
  for update to authenticated using ((select private.is_editor())) with check ((select private.is_editor()));

-- Fotoğraf deposu: herkese kapalı, en fazla 20 MB, yalnızca resim.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ruhsat-gelen', 'ruhsat-gelen', false, 20971520,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists ruhsat_gelen_editor_read on storage.objects;
create policy ruhsat_gelen_editor_read on storage.objects
  for select to authenticated using (bucket_id = 'ruhsat-gelen' and (select private.is_editor()));

-- Anlık bildirim: yeni fotoğraf gelince açık ekranlar hemen haberdar olur.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'incoming_ruhsat'
  ) then
    alter publication supabase_realtime add table public.incoming_ruhsat;
  end if;
end $$;

-- Kontrol: dört satır da "tamam" olmalı.
select 'tablo' as kontrol, case when to_regclass('public.incoming_ruhsat') is not null then 'tamam' else 'EKSİK' end as durum
union all
select 'yetki kuralları', case when count(*) = 2 then 'tamam' else 'EKSİK' end
  from pg_policies where schemaname = 'public' and tablename = 'incoming_ruhsat'
union all
select 'fotoğraf deposu', case when exists (select 1 from storage.buckets where id = 'ruhsat-gelen' and not public) then 'tamam' else 'EKSİK' end
union all
select 'anlık bildirim', case when exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'incoming_ruhsat') then 'tamam' else 'EKSİK' end;
