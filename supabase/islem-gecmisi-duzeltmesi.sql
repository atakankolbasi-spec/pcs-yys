-- İşlem geçmişi tetikleyicisi (visits tablosu) - düzeltilmiş hali.
--
-- Hata: "Kaydı düzenle" ile plaka, müşteri, beyanname, nakliyeci, ruhsat, not veya saat
-- değiştirilince kayıt "malformed array literal: "declaration"" hatasıyla reddediliyordu.
-- Sebep: `ch := ch || 'declaration'` satırında PostgreSQL düz yazıyı da liste sanıyordu.
-- Düzeltme: tek eleman eklemek için array_append kullanılır.
--
-- Supabase > SQL Editor'de bir kez çalıştırın. Tekrar çalıştırmak zararsızdır.

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
