-- Technical entry timestamps are owned by PostgreSQL, not by form/RPC input.
-- The INSERT omits created_at so its timestamptz DEFAULT applies.
-- Existing creation instants remain immutable, including direct server updates.
create function public.maintain_entry_timestamps() returns trigger
language plpgsql set search_path='' as $$
begin
  new.created_at := old.created_at;
  new.updated_at := clock_timestamp();
  return new;
end $$;
create trigger diary_entry_timestamps before update on public.diary_entries
for each row execute function public.maintain_entry_timestamps();
revoke all on function public.maintain_entry_timestamps from public;

-- Keep optimistic concurrency and idempotent receipts. Ignore client technical
-- timestamps explicitly; created_at is absent from both INSERT and UPDATE lists.
create or replace function public.sync_entity(entity_table text,payload jsonb,expected_version integer,operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); eid uuid; old jsonb; result jsonb; clean jsonb; cols text; updates text; allowed text[]; c jsonb; i jsonb; cp integer; ip integer; receipt jsonb;
begin
  if uid is null then raise exception 'Authentication required' using errcode='42501';end if;
  if entity_table not in ('profiles','service_periods','diary_entries','entry_media','books','user_preferences','book_versions') then raise exception 'Invalid entity';end if;
  if pg_column_size(payload)>3000000 then raise exception 'Payload too large';end if;
  eid:=(payload->>'id')::uuid;
  if (payload->>'owner_id')::uuid is distinct from uid then raise exception 'Owner mismatch' using errcode='42501';end if;
  if entity_table in ('profiles','user_preferences') and eid<>uid then raise exception 'ID mismatch';end if;
  perform pg_advisory_xact_lock(hashtextextended(entity_table||eid::text,0));
  select s.result into receipt from public.sync_operations s where s.id=operation_id and s.owner_id=uid;
  if receipt is not null then return receipt;end if;
  execute format('select to_jsonb(t) from public.%I t where id=$1 for update',entity_table) into old using eid;
  if old is not null and (old->>'owner_id')::uuid<>uid then raise exception 'Forbidden' using errcode='42501';end if;
  if entity_table='book_versions' then
    if old is not null then
      if old->'snapshot'<>payload->'snapshot' then raise exception 'Published versions are immutable';end if;
      return jsonb_build_object('record',old);
    end if;
    -- Only own entries and own storage paths may be captured; payload is still untrusted.
    if exists(select 1 from jsonb_array_elements(payload#>'{snapshot,entries}') e where (e->>'owner_id')::uuid<>uid)
      or exists(select 1 from jsonb_array_elements(payload#>'{snapshot,media}') m where (m->>'owner_id')::uuid<>uid or (m->>'storage_path' is not null and m->>'storage_path' not like uid::text||'/%'))
      or (payload#>>'{snapshot,book,owner_id}')::uuid is distinct from uid then raise exception 'Invalid snapshot';end if;
    perform pg_advisory_xact_lock(hashtextextended('book-versions'||(payload->>'book_id'),0));
    insert into public.book_versions(id,owner_id,book_id,number,snapshot,created_at,archived)
    values(eid,uid,(payload->>'book_id')::uuid,(select coalesce(max(v.number),0)+1 from public.book_versions v where v.book_id=(payload->>'book_id')::uuid),payload->'snapshot',now(),false) returning to_jsonb(book_versions.*) into result;
  else
    if coalesce((old->>'version')::integer,0)<>expected_version then return jsonb_build_object('conflict',true,'record',old);end if;
    allowed:=case entity_table
      when 'profiles' then array['name','username','rank_id','function_id','branch_id','barracks_id','unit','avatar_id','discoverable','private_profile','deleted_at']
      when 'service_periods' then array['type','title','start_date','end_date','unit','rank_id','function_id','branch_id','barracks_id','deleted_at']
      when 'diary_entries' then array['period_id','date','subtitle','content','mood','condition','milestone','visibility','media_ids','cover_id','deleted_at']
      when 'entry_media' then array['entry_id','name','mime','size','storage_path','deleted_at']
      when 'books' then array['period_id','title','subtitle','dedication','intro','outro','template','accent','cover_id','deleted_at']
      when 'user_preferences' then array['theme','view','active_period_id','reminder_enabled','reminder_days','reminder_time','deleted_at'] end;
    select string_agg(format('%I',k),','),string_agg(format('%I=excluded.%I',k,k),',') into cols,updates from unnest(allowed||array['id','owner_id','version','updated_at']) k;
    clean:=(payload-'created_at'-'updated_at')||jsonb_build_object('id',eid,'owner_id',uid,'version',expected_version+1,'updated_at',now());
    -- Older clients omit this new field; keep a previously selected location.
    if entity_table in ('profiles','service_periods') then
      clean:=jsonb_set(clean,'{barracks_id}',coalesce(payload->'barracks_id',old->'barracks_id','null'::jsonb));
    end if;
    execute format('insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I,$1) on conflict(id) do update set %3$s returning to_jsonb(%1$I.*)',entity_table,cols,updates) into result using clean;
    if entity_table='diary_entries' and payload->>'deleted_at' is null then
      if not exists(select 1 from public.service_periods p where p.id=(payload->>'period_id')::uuid and p.owner_id=uid and (payload->>'date')::date between p.start_date and p.end_date and p.deleted_at is null) then raise exception 'Date outside service period';end if;
    end if;
    if entity_table='entry_media' and payload->>'entry_id' is not null then
      perform 1 from public.diary_entries where id=(payload->>'entry_id')::uuid for update;
      if not exists(select 1 from public.diary_entries e where e.id=(payload->>'entry_id')::uuid and e.owner_id=uid and eid=any(e.media_ids)) then raise exception 'Image must be selected by its entry';end if;
    end if;
    if entity_table='books' then
      delete from public.book_chapters where book_id=eid and owner_id=uid;cp:=0;
      for c in select * from jsonb_array_elements(payload->'chapters') loop
        insert into public.book_chapters(id,owner_id,book_id,title,position) values((c->>'id')::uuid,uid,eid,c->>'title',cp);cp:=cp+1;ip:=0;
        for i in select * from jsonb_array_elements(c->'items') loop
          insert into public.book_items(id,owner_id,chapter_id,kind,entry_id,title,text,media_ids,position) values((i->>'id')::uuid,uid,(c->>'id')::uuid,i->>'kind',(i->>'entry_id')::uuid,i->>'title',i->>'text',array(select jsonb_array_elements_text(i->'media_ids'))::uuid[],ip);ip:=ip+1;
        end loop;
      end loop;
      result:=result||jsonb_build_object('chapters',payload->'chapters');
    end if;
    if entity_table='user_preferences' then
      insert into public.reminder_preferences(owner_id,enabled,days,local_time) values(uid,(payload->>'reminder_enabled')::boolean,array(select jsonb_array_elements_text(payload->'reminder_days'))::integer[],(payload->>'reminder_time')::time)
      on conflict(owner_id) do update set enabled=excluded.enabled,days=excluded.days,local_time=excluded.local_time,updated_at=now();
    end if;
  end if;
  receipt:=jsonb_build_object('record',result);
  insert into public.sync_operations values(operation_id,uid,entity_table,eid,receipt,now());
  return receipt;
end $$;
revoke all on function public.sync_entity from public;
grant execute on function public.sync_entity to authenticated;
