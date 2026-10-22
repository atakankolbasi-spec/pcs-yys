-- WhatsApp'tan gelen müşteri mesajlarından araç ekleme: veritabanı kurulumu.
--
-- Müşteri WhatsApp numarasına "yarın şu araçlar gelecek: 34 ABC 123 / PB 5678 CD ..." gibi bir yazı gönderince
-- "whatsapp-webhook" sunucu fonksiyonu mesajı bu tabloya kaydeder ve Google Gemini'ye okutur (plaka, tarih, saat;
-- gelecek mi, ertelendi mi, iptal mi). Sonuç sitede "Ruhsattan ekle" penceresinin üstündeki "WhatsApp mesajları"
-- bölümünde onay bekler; hiçbir araç siz onaylamadan panoya eklenmez, değiştirilmez ya da silinmez.
--
-- Önce whatsapp-kurulumu.sql çalıştırılmış olmalı (yetki fonksiyonu private.is_editor() orada da kullanılır).
-- Supabase > SQL Editor'de bir kez çalıştırın. Tekrar çalıştırmak zararsızdır.

create table if not exists public.incoming_messages (
  id uuid primary key default gen_random_uuid(),
  wa_message_id text not null unique,          -- aynı mesaj iki kez gelirse ikinci kayıt açılmaz
  from_number text not null default '',        -- gönderenin numarası (905321234567 biçiminde)
  sender_name text not null default '',        -- gönderenin WhatsApp'taki adı
  body text not null default '',               -- mesajın yazısı (en fazla 4000 karakter)
  status text not null default 'okunuyor'
    check (status in ('okunuyor', 'bekliyor', 'eklendi', 'yoksayildi', 'hata')),
  ai jsonb,                                    -- yapay zekânın cevabı: {items: [{action, tractor, trailer, date, time, note}], customer, problem}
  applied jsonb not null default '{}'::jsonb,  -- araç araç ne yapıldı: {"0": {"r": "eklendi", "visit_id": "..."}}
  note text not null default '',               -- okunamadıysa nedeni
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists incoming_messages_acik on public.incoming_messages (created_at)
  where status in ('okunuyor', 'bekliyor', 'hata');
create index if not exists incoming_messages_numara on public.incoming_messages (from_number, created_at);

create or replace function public.incoming_messages_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists incoming_messages_touch on public.incoming_messages;
create trigger incoming_messages_touch before update on public.incoming_messages
  for each row execute function public.incoming_messages_touch();

-- Yetki: yalnızca düzenleyiciler görür ve günceller. Satırı yalnızca sunucu fonksiyonu ekler
-- (gizli anahtarla çalıştığı için bu kurallara takılmaz). Kimse silemez; yalnızca sunucu fonksiyonu
-- 60 günden eski kapanmış mesajları temizler.
alter table public.incoming_messages enable row level security;
revoke all on public.incoming_messages from anon;
grant select, update on public.incoming_messages to authenticated;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete on public.incoming_messages to service_role';
  end if;
end $$;

drop policy if exists incoming_messages_editor_read on public.incoming_messages;
create policy incoming_messages_editor_read on public.incoming_messages
  for select to authenticated using ((select private.is_editor()));

drop policy if exists incoming_messages_editor_update on public.incoming_messages;
create policy incoming_messages_editor_update on public.incoming_messages
  for update to authenticated using ((select private.is_editor())) with check ((select private.is_editor()));

-- Anlık bildirim: yeni mesaj gelince açık ekranlar hemen haberdar olur.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'incoming_messages'
  ) then
    alter publication supabase_realtime add table public.incoming_messages;
  end if;
end $$;

-- Kontrol: beş satır da "tamam" olmalı.
select 'tablo' as kontrol, case when to_regclass('public.incoming_messages') is not null then 'tamam' else 'EKSİK' end as durum
union all
select 'sunucu fonksiyonu yetkisi', case when exists (select 1 from pg_roles where rolname = 'service_role')
    and has_table_privilege('service_role', 'public.incoming_messages', 'SELECT')
    and has_table_privilege('service_role', 'public.incoming_messages', 'INSERT')
    and has_table_privilege('service_role', 'public.incoming_messages', 'UPDATE')
    and has_table_privilege('service_role', 'public.incoming_messages', 'DELETE') then 'tamam' else 'EKSİK' end
union all
select 'yetki kuralları', case when count(*) = 2 then 'tamam' else 'EKSİK' end
  from pg_policies where schemaname = 'public' and tablename = 'incoming_messages'
    and policyname in ('incoming_messages_editor_read', 'incoming_messages_editor_update')
union all
select 'anlık bildirim', case when exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'incoming_messages') then 'tamam' else 'EKSİK' end
union all
select 'düzenleyici yetkisi (whatsapp-kurulumu.sql)', case when to_regprocedure('private.is_editor()') is not null then 'tamam' else 'EKSİK' end;
