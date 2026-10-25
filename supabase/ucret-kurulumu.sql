-- Araç ücreti: her geliş için ayrı "Ücret" alanı (aylık müşteri raporu için).
--
-- Araç kaydında "Ücret" (tutar) ve "Para birimi" kutuları çıkar; müşterinin gönderdiği listedeki ücret ("90 EURO")
-- de notta kalmak yerine bu alana yazılır. Sitede Raporlar > "Aylık müşteri raporu", her müşterinin ayki araç
-- sayısını ve ücret toplamını (para birimi ayrı) gösterir ve Excel'e aktarır.
--
-- Bu dosya çalıştırılmadan site eskisi gibi çalışır: Ücret kutuları çıkmaz, ücret notta kalır. Rapor yalnızca notun
-- başındaki tutarları ("90 EURO · ...") sayar. Eski kayıtlara dokunulmaz.
--
-- Supabase > SQL Editor'de bir kez çalıştırın. Tekrar çalıştırmak zararsızdır.

alter table public.visits add column if not exists fee_amount numeric(12,2);
alter table public.visits add column if not exists fee_currency text not null default '';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'visits_fee_amount_check') then
    alter table public.visits add constraint visits_fee_amount_check
      check (fee_amount is null or (fee_amount >= 0 and fee_amount < 10000000));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'visits_fee_currency_check') then
    alter table public.visits add constraint visits_fee_currency_check
      check (fee_currency in ('', 'EUR', 'USD', 'TRY', 'GBP'));
  end if;
end $$;

-- Tablo yetkileri zaten tablo düzeyindeyse bu satırlar bir şey değiştirmez; sütun düzeyindeyse yeni sütunları da kapsar.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select (fee_amount, fee_currency), insert (fee_amount, fee_currency), update (fee_amount, fee_currency) on public.visits to authenticated';
  end if;
end $$;

notify pgrst, 'reload schema';

-- Kontrol: iki satır da "tamam" olmalı.
select 'ücret tutarı' as kontrol, case when exists (select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'visits' and column_name = 'fee_amount') then 'tamam' else 'EKSİK' end as durum
union all
select 'para birimi', case when exists (select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'visits' and column_name = 'fee_currency') then 'tamam' else 'EKSİK' end;
