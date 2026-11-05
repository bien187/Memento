-- Explicit opt-in: existing profiles never expose additional service information.
alter table public.profiles
  add column share_function boolean not null default false,
  add column share_service_period boolean not null default false,
  add column share_connections boolean not null default false;

create index community_entry_order on public.diary_entries(date desc,created_at desc,id desc)
  where deleted_at is null and visibility in ('public','followers');
create index community_owner_entry_order on public.diary_entries(owner_id,date desc,created_at desc,id desc)
  where deleted_at is null and visibility in ('public','followers');

-- Internal predicates run only inside the bounded projections below. Base-table
-- RLS remains owner-only; no new direct table privileges are granted.
create function public.community_can_view_profile(viewer uuid,person uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select viewer is not null and exists(
    select 1 from public.profiles p where p.id=person and p.deleted_at is null
      and not public.is_blocked(viewer,p.id)
      and (p.id=viewer or p.discoverable
        or exists(select 1 from public.follows f where (f.follower_id=viewer and f.following_id=p.id) or (f.following_id=viewer and f.follower_id=p.id))
        or exists(select 1 from public.follow_requests r where (r.requester_id=viewer and r.target_id=p.id) or (r.target_id=viewer and r.requester_id=p.id)))
  );
$$;
create function public.community_can_read_entry(viewer uuid,entry_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select viewer is not null and exists(
    select 1 from public.diary_entries d
      join public.profiles p on p.id=d.owner_id
      join public.service_periods s on s.id=d.period_id and s.owner_id=d.owner_id
    where d.id=entry_id and d.deleted_at is null and s.deleted_at is null
      and public.community_can_view_profile(viewer,p.id)
      and (d.visibility='public' and (p.discoverable or viewer=p.id)
        or d.visibility='followers' and (viewer=p.id or exists(select 1 from public.follows f where f.follower_id=viewer and f.following_id=p.id)))
  );
$$;
create function public.community_person(viewer uuid,person uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'id',p.id,'name',p.name,'username',p.username,'private_profile',p.private_profile,
    'rank_id',p.rank_id,'branch_id',p.branch_id,
    'function_id',case when p.share_function then p.function_id end,
    'avatar_id',(select m.id from public.entry_media m where m.id=p.avatar_id and m.owner_id=p.id and m.entry_id is null and m.deleted_at is null),
    'following',exists(select 1 from public.follows f where f.follower_id=viewer and f.following_id=p.id),
    'requested',exists(select 1 from public.follow_requests r where r.requester_id=viewer and r.target_id=p.id),
    'followers',case when p.share_connections or p.id=viewer then (select count(*) from public.follows f join public.profiles other on other.id=f.follower_id where f.following_id=p.id and other.deleted_at is null and not public.is_blocked(viewer,other.id)) end
  ) from public.profiles p where p.id=person and public.community_can_view_profile(viewer,p.id);
$$;
revoke all on function public.community_can_view_profile,public.community_can_read_entry,public.community_person from public,anon,authenticated;

drop function public.community_people(text);
create function public.community_people(query text default '',branch text default null)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(public.community_person(auth.uid(),p.id) order by lower(p.name),p.id),'[]'::jsonb)
  from (
    select pr.id,pr.name from public.profiles pr
    where auth.uid() is not null and pr.id<>auth.uid() and pr.discoverable and pr.deleted_at is null
      and not public.is_blocked(auth.uid(),pr.id)
      and (branch is null or pr.branch_id=branch)
      and (position(lower(left(coalesce(query,''),80)) in lower(pr.name))>0
        or position(lower(left(coalesce(query,''),80)) in lower(coalesce(pr.username,'')))>0)
    order by lower(pr.name),pr.id limit 40
  ) p;
$$;

create function public.community_profile(person uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select public.community_person(auth.uid(),p.id)||jsonb_build_object(
    'share_function',p.share_function,'share_service_period',p.share_service_period,'share_connections',p.share_connections,
    'following_count',case when p.share_connections or p.id=auth.uid() then (select count(*) from public.follows f join public.profiles other on other.id=f.following_id where f.follower_id=p.id and other.deleted_at is null and not public.is_blocked(auth.uid(),other.id)) end,
    'entry_count',(select count(*) from public.diary_entries d where d.owner_id=p.id and public.community_can_read_entry(auth.uid(),d.id)),
    'milestone_count',(select count(*) from public.diary_entries d where d.owner_id=p.id and d.milestone and public.community_can_read_entry(auth.uid(),d.id)),
    'periods',case when p.share_service_period then (
      select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'type',s.type,'start_date',s.start_date,'end_date',s.end_date) order by s.start_date desc,s.id),'[]'::jsonb)
      from public.service_periods s where s.owner_id=p.id and s.deleted_at is null
        and exists(select 1 from public.diary_entries d where d.period_id=s.id and public.community_can_read_entry(auth.uid(),d.id))
    ) else '[]'::jsonb end
  ) from public.profiles p where p.id=person and public.community_can_view_profile(auth.uid(),p.id);
$$;

-- A single projection is reused for full readers and feed previews. Private
-- ratings, units, barracks and personal period titles never cross this boundary.
create function public.community_entry_projection(viewer uuid,entry_id uuid,preview boolean)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'id',d.id,'owner_id',d.owner_id,'date',d.date,'created_at',d.created_at,
    'subtitle',d.subtitle,'content',case when preview then left(d.content,600) else d.content end,
    'milestone',d.milestone,
    'media_ids',coalesce((select jsonb_agg(m.id order by selected.position)
      from unnest(d.media_ids) with ordinality selected(id,position)
      join public.entry_media m on m.id=selected.id and m.owner_id=d.owner_id and m.entry_id=d.id and m.deleted_at is null),'[]'::jsonb),
    'cover_id',(select m.id from public.entry_media m where m.id=d.cover_id and m.id=any(d.media_ids) and m.owner_id=d.owner_id and m.entry_id=d.id and m.deleted_at is null),
    'name',p.name,'username',p.username,'avatar_id',(public.community_person(viewer,p.id)->'avatar_id'),
    'rank_id',p.rank_id,'branch_id',p.branch_id,
    'start_date',case when p.share_service_period then s.start_date end,
    'period_type',case when p.share_service_period then s.type end
  ) from public.diary_entries d
    join public.profiles p on p.id=d.owner_id
    join public.service_periods s on s.id=d.period_id
  where d.id=entry_id and public.community_can_read_entry(viewer,d.id);
$$;
revoke all on function public.community_entry_projection from public,anon,authenticated;

drop function public.community_feed(uuid);
create function public.community_feed(
  person uuid default null,page_size integer default 20,
  before_date date default null,before_created_at timestamptz default null,before_id uuid default null,
  only_milestones boolean default false
) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if num_nonnulls(before_date,before_created_at,before_id) not in (0,3) then
    raise exception 'Incomplete pagination cursor';
  end if;
  return (
    select coalesce(jsonb_agg(public.community_entry_projection(auth.uid(),e.id,true) order by e.date desc,e.created_at desc,e.id desc),'[]'::jsonb)
    from (
      select d.id,d.date,d.created_at from public.diary_entries d
      where public.community_can_read_entry(auth.uid(),d.id)
        and (not coalesce(only_milestones,false) or d.milestone)
        and (person is null or d.owner_id=person)
        and (person is not null or exists(select 1 from public.follows f where f.follower_id=auth.uid() and f.following_id=d.owner_id))
        and (before_date is null or (d.date,d.created_at,d.id)<(before_date,before_created_at,before_id))
      order by d.date desc,d.created_at desc,d.id desc limit greatest(1,least(coalesce(page_size,20),50))
    ) e
  );
end $$;
create function public.community_entry(entry_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select public.community_entry_projection(auth.uid(),entry_id,false);
$$;

create or replace function public.community_requests()
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(public.community_person(auth.uid(),p.id) order by r.created_at,p.id),'[]'::jsonb)
  from public.follow_requests r join public.profiles p on p.id=r.requester_id
  where r.target_id=auth.uid() and public.community_can_view_profile(auth.uid(),p.id);
$$;

drop function public.community_connections(text);
create function public.community_connections(kind text,person uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare subject uuid:=coalesce(person,auth.uid());
begin
  if auth.uid() is null then return '[]'::jsonb;end if;
  if kind not in ('followers','following','blocked') then raise exception 'Invalid connection list';end if;
  if kind='blocked' then
    if subject<>auth.uid() then return '[]'::jsonb;end if;
    return (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'username',p.username) order by lower(p.name),p.id),'[]'::jsonb)
      from public.profiles p join public.blocks b on b.blocked_id=p.id where b.blocker_id=auth.uid() and p.deleted_at is null);
  end if;
  if not public.community_can_view_profile(auth.uid(),subject)
    or (subject<>auth.uid() and not exists(select 1 from public.profiles p where p.id=subject and p.share_connections)) then return '[]'::jsonb;end if;
  return (select coalesce(jsonb_agg(public.community_person(auth.uid(),p.id) order by lower(p.name),p.id),'[]'::jsonb)
    from public.profiles p where public.community_can_view_profile(auth.uid(),p.id) and (
      kind='followers' and exists(select 1 from public.follows f where f.follower_id=p.id and f.following_id=subject)
      or kind='following' and exists(select 1 from public.follows f where f.following_id=p.id and f.follower_id=subject)
    ));
end $$;

-- Only the exact, currently selected media reference is authorized. Returning a
-- private path does not grant Storage access; the server proxies the download.
create function public.community_media(media_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',m.id,'owner_id',m.owner_id,'storage_path',m.storage_path,'mime',m.mime)
  from public.entry_media m join public.diary_entries d on d.id=m.entry_id and d.owner_id=m.owner_id
  where m.id=media_id and m.deleted_at is null and m.id=any(d.media_ids)
    and public.community_can_read_entry(auth.uid(),d.id)
    and m.storage_path=m.owner_id::text||'/'||m.id::text||'.'||split_part(m.mime,'/',2);
$$;
create function public.community_avatar(person uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',m.id,'owner_id',m.owner_id,'storage_path',m.storage_path,'mime',m.mime)
  from public.profiles p join public.entry_media m on m.id=p.avatar_id and m.owner_id=p.id
  where p.id=person and public.community_can_view_profile(auth.uid(),p.id)
    and m.entry_id is null and m.deleted_at is null
    and m.storage_path=m.owner_id::text||'/'||m.id::text||'.'||split_part(m.mime,'/',2);
$$;

create or replace function public.community_action(target uuid,action text)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); priv boolean;
begin
  if uid is null or target is null or uid=target then raise exception 'Invalid request';end if;
  perform pg_advisory_xact_lock(hashtextextended(least(uid::text,target::text)||greatest(uid::text,target::text),0));
  if action='block' then
    insert into public.blocks values(uid,target,now()) on conflict do nothing;
    delete from public.follows where (follower_id=uid and following_id=target) or (follower_id=target and following_id=uid);
    delete from public.follow_requests where (requester_id=uid and target_id=target) or (requester_id=target and target_id=uid);return;
  elsif action='unblock' then delete from public.blocks where blocker_id=uid and blocked_id=target;return;end if;
  if public.is_blocked(uid,target) then raise exception 'Unavailable';end if;
  if action='follow' then
    select p.private_profile into priv from public.profiles p
      where p.id=target and p.deleted_at is null and (p.discoverable or public.community_can_view_profile(uid,p.id));
    if priv is null then raise exception 'Unavailable';end if;
    if exists(select 1 from public.follows f where f.follower_id=uid and f.following_id=target) then
      delete from public.follow_requests where requester_id=uid and target_id=target;return;
    end if;
    if priv then insert into public.follow_requests values(uid,target,now()) on conflict do nothing;
    else
      insert into public.follows values(uid,target,now()) on conflict do nothing;
      delete from public.follow_requests where requester_id=uid and target_id=target;
    end if;
  elsif action='unfollow' then
    delete from public.follows where follower_id=uid and following_id=target;
    delete from public.follow_requests where requester_id=uid and target_id=target;
  elsif action='accept' then
    if exists(select 1 from public.profiles p where p.id=uid and p.deleted_at is null)
      and exists(select 1 from public.profiles p where p.id=target and p.deleted_at is null)
      and exists(select 1 from public.follow_requests r where r.requester_id=target and r.target_id=uid) then
      insert into public.follows values(target,uid,now()) on conflict do nothing;
      delete from public.follow_requests where requester_id=target and target_id=uid;
    end if;
  elsif action='reject' then delete from public.follow_requests where requester_id=target and target_id=uid;
  else raise exception 'Invalid action';end if;
end $$;

revoke all on function public.community_people,public.community_profile,public.community_feed,public.community_entry,public.community_requests,public.community_connections,public.community_media,public.community_avatar,public.community_action from public,anon;
grant execute on function public.community_people,public.community_profile,public.community_feed,public.community_entry,public.community_requests,public.community_connections,public.community_media,public.community_avatar,public.community_action to authenticated;

-- Extend timestamp-safe synchronization only after the opt-in columns exist.
create or replace function public.sync_entity(entity_table text,payload jsonb,expected_version integer,operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); eid uuid; old jsonb; result jsonb; clean jsonb; cols text; updates text; allowed text[]; c jsonb; i jsonb; cp integer; ip integer; receipt jsonb; setting_key text;
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
      when 'profiles' then array['name','username','rank_id','function_id','branch_id','barracks_id','unit','avatar_id','discoverable','private_profile','share_function','share_service_period','share_connections','deleted_at']
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
    if entity_table='profiles' then
      foreach setting_key in array array['share_function','share_service_period','share_connections'] loop
        clean:=jsonb_set(clean,array[setting_key],coalesce(payload->setting_key,old->setting_key,'false'::jsonb));
      end loop;
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
