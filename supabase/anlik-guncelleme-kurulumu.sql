-- Anlık güncelleme (Supabase Realtime) kurulumu.
--
-- Site, birisi araç / plaka / ayar değiştirdiğinde diğer ekranları hemen yenilemek için
-- Supabase Realtime'ı dinler. Bunun çalışması için tabloların "supabase_realtime" yayınına
-- eklenmesi gerekir. Eklenmezse site yine 15 saniyede bir kendini yeniler; sadece anlık olmaz.
--
-- Yetki kuralları (RLS) Realtime'da da geçerlidir: kimse göremediği kaydın bildirimini almaz.
-- Supabase > SQL Editor'de bir kez çalıştırın. Tekrar çalıştırmak zararsızdır.

do $$
declare
  t text;
begin
  foreach t in array array['visits', 'registry', 'app_settings'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Kontrol: üç tablo da listelenmeli.
select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
order by 1;
