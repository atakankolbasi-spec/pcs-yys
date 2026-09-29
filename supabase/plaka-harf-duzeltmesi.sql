-- Plakalardaki Kiril / Yunan harfleri Latin harfe çevirir.
--
-- Bulgar ya da Yunan belgesinden kopyalanan plakalarda harfler Kiril ya da Yunan olabilir: "Х 8123 КТ"
-- gözle "X 8123 KT" ile aynıdır ama bilgisayar için farklıdır. Site artık bunları kendisi tanıyor
-- (ülke bandı, eşleştirme, arama) ve yeni kayıtları Latin harfle kaydediyor. Bu dosya eski kayıtları
-- da düzeltir; Excel çıktısında ve başka programlarda da doğru görünsünler diye. Çalıştırmak isteğe bağlı.
--
-- Supabase > SQL Editor. Önce 1. bölümü tek başına çalıştırıp hangi plakaların değişeceğine bakın.

-- 1) KONTROL: Kiril / Yunan harf ya da görünmez karakter içeren plakalar
select 'visits' as tablo, plate as simdiki, regexp_replace(translate(plate, 'АВЕКМНОРСТУХІЈЅабекмнорстухіјѕΑΒΕΖΗΙΚΜΝΟΡΤΥΧαβεζηικμνορτυχ', 'ABEKMHOPCTYXIJSABEKMHOPCTYXIJSABEZHIKMNOPTYXABEZHIKMNOPTYX'), '[\u00AD\u200B-\u200D\u2060\uFEFF]', '', 'g') as duzeltilmis
from public.visits where plate ~ '[\u0370-\u03FF\u0400-\u04FF\u00AD\u200B-\u200D\u2060\uFEFF]'
union all
select 'registry', plate, regexp_replace(translate(plate, 'АВЕКМНОРСТУХІЈЅабекмнорстухіјѕΑΒΕΖΗΙΚΜΝΟΡΤΥΧαβεζηικμνορτυχ', 'ABEKMHOPCTYXIJSABEKMHOPCTYXIJSABEZHIKMNOPTYXABEZHIKMNOPTYX'), '[\u00AD\u200B-\u200D\u2060\uFEFF]', '', 'g')
from public.registry where plate ~ '[\u0370-\u03FF\u0400-\u04FF\u00AD\u200B-\u200D\u2060\uFEFF]'
order by 1, 2;

-- 2) DÜZELTME: 1. bölümün sonucu doğruysa aşağıdakini çalıştırın.
--    Plaka kayıtlarında düzeltilmiş hali zaten başka bir kayıtta varsa o satıra dokunulmaz (çift kayıt
--    oluşmasın); en alttaki sorgu bunları listeler, elle birleştirmeniz gerekir.
--    Not: işlem geçmişine "plaka düzenlendi" satırları düşer.
update public.visits set plate = regexp_replace(translate(plate, 'АВЕКМНОРСТУХІЈЅабекмнорстухіјѕΑΒΕΖΗΙΚΜΝΟΡΤΥΧαβεζηικμνορτυχ', 'ABEKMHOPCTYXIJSABEKMHOPCTYXIJSABEZHIKMNOPTYXABEZHIKMNOPTYX'), '[\u00AD\u200B-\u200D\u2060\uFEFF]', '', 'g') where plate ~ '[\u0370-\u03FF\u0400-\u04FF\u00AD\u200B-\u200D\u2060\uFEFF]';

update public.registry r set plate = regexp_replace(translate(r.plate, 'АВЕКМНОРСТУХІЈЅабекмнорстухіјѕΑΒΕΖΗΙΚΜΝΟΡΤΥΧαβεζηικμνορτυχ', 'ABEKMHOPCTYXIJSABEKMHOPCTYXIJSABEZHIKMNOPTYXABEZHIKMNOPTYX'), '[\u00AD\u200B-\u200D\u2060\uFEFF]', '', 'g')
where r.plate ~ '[\u0370-\u03FF\u0400-\u04FF\u00AD\u200B-\u200D\u2060\uFEFF]'
  and not exists (
    select 1 from public.registry x
    where x.id <> r.id
      and upper(regexp_replace(x.plate, '[\s.-]', '', 'g')) = upper(regexp_replace(regexp_replace(translate(r.plate, 'АВЕКМНОРСТУХІЈЅабекмнорстухіјѕΑΒΕΖΗΙΚΜΝΟΡΤΥΧαβεζηικμνορτυχ', 'ABEKMHOPCTYXIJSABEKMHOPCTYXIJSABEZHIKMNOPTYXABEZHIKMNOPTYX'), '[\u00AD\u200B-\u200D\u2060\uFEFF]', '', 'g'), '[\s.-]', '', 'g'))
  );

-- Kalanlar (0 satır olmalı; satır çıkarsa bu plakalar kayıtlarda iki kez var)
select 'visits' as tablo, plate from public.visits where plate ~ '[\u0370-\u03FF\u0400-\u04FF\u00AD\u200B-\u200D\u2060\uFEFF]'
union all
select 'registry', plate from public.registry where plate ~ '[\u0370-\u03FF\u0400-\u04FF\u00AD\u200B-\u200D\u2060\uFEFF]';
