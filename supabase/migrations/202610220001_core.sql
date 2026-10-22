-- Feldbuch. Run via `supabase db reset` locally or `supabase db push` on your project.
create extension if not exists pgcrypto with schema extensions;

create table public.military_ranks (id text primary key, name text not null, position integer not null, insignia_url text, source_url text not null default 'https://www.armee.ch/de/militaerische-abzeichen');
create table public.military_functions (id text primary key, name text not null, source_url text not null default 'https://www.armee.ch/de/wie-sieht-der-weg-zum-dienst-aus');
create table public.military_branches (id text primary key, name text not null, accent text not null default 'olive', source_url text not null default 'https://www.armee.ch/de/militaerische-abzeichen');
create table public.military_units (id uuid primary key default gen_random_uuid(), name text not null, source_url text);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  owner_id uuid not null unique references auth.users(id) on delete cascade check(owner_id=id),
  name text not null check(char_length(name) between 2 and 100),
  username text unique check(username is null or username ~ '^[a-z0-9_]{3,30}$'),
  rank_id text references public.military_ranks(id), function_id text references public.military_functions(id), branch_id text references public.military_branches(id),
  unit text not null default '' check(char_length(unit)<=100), avatar_id uuid,
  discoverable boolean not null default false, private_profile boolean not null default true,
  version integer not null default 1, updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table public.service_periods (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  type text not null check(type in ('RS','WK','UOS','OS','Andere')), title text not null check(char_length(title) between 2 and 120),
  start_date date not null,end_date date not null check(end_date>=start_date), unit text not null default '' check(char_length(unit)<=100),
  rank_id text references public.military_ranks(id),function_id text references public.military_functions(id),branch_id text references public.military_branches(id),
  version integer not null default 1,updated_at timestamptz not null default now(),deleted_at timestamptz,unique(id,owner_id)
);
create table public.diary_entries (
  id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,
  period_id uuid not null,date date not null,subtitle text not null default '' check(char_length(subtitle)<=160),content text not null default '' check(char_length(content)<=100000),
  mood integer check(mood between 0 and 100),condition integer check(condition between 0 and 100),milestone boolean not null default false,
  visibility text not null default 'private' check(visibility in ('private','followers','link','public')),
  media_ids uuid[] not null default '{}' check(cardinality(media_ids)<=4),cover_id uuid,
  created_at timestamptz not null default now(),version integer not null default 1,updated_at timestamptz not null default now(),deleted_at timestamptz,
  search_document tsvector generated always as (to_tsvector('german',subtitle||' '||content)) stored,
  unique(id,owner_id),foreign key(period_id,owner_id) references public.service_periods(id,owner_id) on delete cascade,
  check(cover_id is null or cover_id=any(media_ids))
);
create index diary_period_date on public.diary_entries(owner_id,period_id,date desc);
create index diary_search on public.diary_entries using gin(search_document);
create table public.entry_media (
  id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,entry_id uuid,
  name text not null check(char_length(name)<=200),mime text not null check(mime in ('image/jpeg','image/png','image/webp')),
  size integer not null check(size>0 and size<=5242880),storage_path text check(storage_path is null or storage_path=owner_id::text||'/'||id::text||'.'||split_part(mime,'/',2)),
  version integer not null default 1,updated_at timestamptz not null default now(),deleted_at timestamptz,
  unique(id,owner_id),foreign key(entry_id,owner_id) references public.diary_entries(id,owner_id) on delete cascade
);
create index media_entry on public.entry_media(entry_id);
create table public.user_preferences (
  id uuid primary key references auth.users(id) on delete cascade,owner_id uuid not null unique references auth.users(id) on delete cascade check(owner_id=id),
  theme text not null default 'system' check(theme in ('light','dark','system')),view text not null default 'grid' check(view in ('grid','timeline','cards')),
  active_period_id uuid,reminder_enabled boolean not null default false,reminder_days integer[] not null default '{0,1,2,3,4,5,6}' check(reminder_days<@array[0,1,2,3,4,5,6]),
  reminder_time text not null default '20:30' check(reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  version integer not null default 1,updated_at timestamptz not null default now(),deleted_at timestamptz
);
create table public.reminder_preferences (
  owner_id uuid primary key references auth.users(id) on delete cascade,enabled boolean not null default false,days integer[] not null default '{}',local_time time not null default '20:30',timezone text not null default 'Europe/Zurich',updated_at timestamptz not null default now()
);
create table public.books (
  id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,period_id uuid not null,
  title text not null check(char_length(title) between 2 and 160),subtitle text not null default '',dedication text not null default '',intro text not null default '',outro text not null default '',
  template text not null default 'editorial' check(template in ('editorial','dienstbuch','fotoreportage')),accent text not null default 'olive' check(accent in ('olive','slate','rust')),cover_id uuid,
  version integer not null default 1,updated_at timestamptz not null default now(),deleted_at timestamptz,
  unique(id,owner_id),foreign key(period_id,owner_id) references public.service_periods(id,owner_id) on delete cascade
);
create table public.book_chapters (
  id uuid primary key,owner_id uuid not null references auth.users(id) on delete cascade,book_id uuid not null,title text not null check(char_length(title)<=160),position integer not null check(position>=0),
  unique(id,owner_id),foreign key(book_id,owner_id) references public.books(id,owner_id) on delete cascade,unique(book_id,position)
);
create table public.book_items (
  id uuid primary key,owner_id uuid not null references auth.users(id) on delete cascade,chapter_id uuid not null,kind text not null check(kind in ('entry','text','gallery')),
  entry_id uuid,title text not null default '',text text not null default '' check(char_length(text)<=100000),media_ids uuid[] not null default '{}',position integer not null check(position>=0),
  foreign key(chapter_id,owner_id) references public.book_chapters(id,owner_id) on delete cascade,
  foreign key(entry_id,owner_id) references public.diary_entries(id,owner_id),unique(chapter_id,position)
);
create table public.book_versions (
  id uuid primary key,owner_id uuid not null references auth.users(id) on delete cascade,book_id uuid not null,number integer not null check(number>0),
  snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),created_at timestamptz not null default now(),archived boolean not null default false,
  unique(id,owner_id),unique(book_id,number),foreign key(book_id,owner_id) references public.books(id,owner_id) on delete cascade
);
create table public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),primary key(follower_id,following_id),check(follower_id<>following_id)
);
create table public.follow_requests (
  requester_id uuid not null references auth.users(id) on delete cascade,target_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),primary key(requester_id,target_id),check(requester_id<>target_id)
);
create table public.blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),primary key(blocker_id,blocked_id),check(blocker_id<>blocked_id)
);
create table public.diary_shares (
  id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,period_id uuid not null,
  token_hash text not null unique check(char_length(token_hash)=64),password_hash text,display_name text not null check(char_length(display_name)<=100),
  excluded_entry_ids uuid[] not null default '{}',expires_at timestamptz,revoked_at timestamptz,created_at timestamptz not null default now(),
  foreign key(period_id,owner_id) references public.service_periods(id,owner_id) on delete cascade
);
create table public.book_shares (
  id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,version_id uuid not null,
  token_hash text not null unique check(char_length(token_hash)=64),password_hash text,display_name text not null check(char_length(display_name)<=100),
  expires_at timestamptz,revoked_at timestamptz,created_at timestamptz not null default now(),
  foreign key(version_id,owner_id) references public.book_versions(id,owner_id) on delete cascade
);
create table public.sync_operations (
  id uuid primary key,owner_id uuid not null references auth.users(id) on delete cascade,entity_table text not null,entity_id uuid not null,
  result jsonb not null,created_at timestamptz not null default now()
);
create index sync_owner on public.sync_operations(owner_id,created_at);
create table public.rate_limits (key text primary key,window_at timestamptz not null,hits integer not null);

-- Every table is private unless the following policy explicitly grants a read.
do $$ declare t text; begin
  foreach t in array array['military_ranks','military_functions','military_branches','military_units'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy catalog_read on public.%I for select using (true)',t);
    execute format('grant select on public.%I to anon, authenticated',t);
  end loop;
  foreach t in array array['profiles','service_periods','diary_entries','entry_media','books','book_chapters','book_items','book_versions','diary_shares','book_shares','reminder_preferences','user_preferences','sync_operations'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy owner_access on public.%I for all to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()))',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
  end loop;
end $$;
alter table public.follows enable row level security;
alter table public.follow_requests enable row level security;
alter table public.blocks enable row level security;
alter table public.rate_limits enable row level security;
create policy participant on public.follows for select to authenticated using(auth.uid() in(follower_id,following_id));
create policy participant on public.follow_requests for select to authenticated using(auth.uid() in(requester_id,target_id));
create policy blocker on public.blocks for select to authenticated using(auth.uid()=blocker_id);
revoke all on public.follows,public.follow_requests,public.blocks,public.rate_limits from anon,authenticated;
grant select on public.follows,public.follow_requests,public.blocks to authenticated;
grant insert,update,delete on public.diary_shares,public.book_shares to authenticated;

create function public.is_blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.blocks where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a));
$$;
revoke all on function public.is_blocked from public;

-- Optimistic concurrency and durable receipts make retries idempotent.
create function public.sync_entity(entity_table text,payload jsonb,expected_version integer,operation_id uuid)
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
      when 'profiles' then array['name','username','rank_id','function_id','branch_id','unit','avatar_id','discoverable','private_profile','deleted_at']
      when 'service_periods' then array['type','title','start_date','end_date','unit','rank_id','function_id','branch_id','deleted_at']
      when 'diary_entries' then array['period_id','date','subtitle','content','mood','condition','milestone','visibility','media_ids','cover_id','created_at','deleted_at']
      when 'entry_media' then array['entry_id','name','mime','size','storage_path','deleted_at']
      when 'books' then array['period_id','title','subtitle','dedication','intro','outro','template','accent','cover_id','deleted_at']
      when 'user_preferences' then array['theme','view','active_period_id','reminder_enabled','reminder_days','reminder_time','deleted_at'] end;
    select string_agg(format('%I',k),','),string_agg(format('%I=excluded.%I',k,k),',') into cols,updates from unnest(allowed||array['id','owner_id','version','updated_at']) k;
    clean:=payload||jsonb_build_object('id',eid,'owner_id',uid,'version',expected_version+1,'updated_at',now());
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

create function public.community_people(query text default '') returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(row_to_json(p)),'[]'::jsonb) from (
    select pr.id,pr.name,pr.username,pr.private_profile,pr.rank_id,pr.branch_id,
      exists(select 1 from public.follows f where f.follower_id=auth.uid() and f.following_id=pr.id) as following,
      exists(select 1 from public.follow_requests f where f.requester_id=auth.uid() and f.target_id=pr.id) as requested,
      (select count(*) from public.follows f where f.following_id=pr.id) as followers
    from public.profiles pr where auth.uid() is not null and pr.id<>auth.uid() and pr.discoverable and pr.deleted_at is null
    and not public.is_blocked(auth.uid(),pr.id) and (pr.name ilike '%'||left(query,80)||'%' or pr.username ilike '%'||left(query,80)||'%') order by pr.name limit 40
  ) p;
$$;
create function public.community_feed(person uuid default null) returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(row_to_json(e)),'[]'::jsonb) from (
    select d.id,d.owner_id,d.date,d.subtitle,d.content,d.milestone,d.media_ids,d.cover_id,p.name,p.username,
      s.start_date,s.type as period_type
    from public.diary_entries d join public.profiles p on p.id=d.owner_id join public.service_periods s on s.id=d.period_id
    where auth.uid() is not null and d.deleted_at is null and p.deleted_at is null and s.deleted_at is null and not public.is_blocked(auth.uid(),d.owner_id)
      and (person is null or d.owner_id=person)
      and (d.visibility='public' and p.discoverable or d.visibility='followers' and exists(select 1 from public.follows f where f.follower_id=auth.uid() and f.following_id=d.owner_id))
      and (person is not null or exists(select 1 from public.follows f where f.follower_id=auth.uid() and f.following_id=d.owner_id))
    order by d.date desc,d.created_at desc limit 100
  ) e;
$$;
create function public.community_requests() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'username',p.username)),'[]') from public.follow_requests r join public.profiles p on p.id=r.requester_id where r.target_id=auth.uid() and not public.is_blocked(p.id,auth.uid());
$$;
create function public.community_action(target uuid,action text) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); priv boolean;
begin
 if uid is null or uid=target then raise exception 'Invalid request';end if;
 perform pg_advisory_xact_lock(hashtextextended(least(uid::text,target::text)||greatest(uid::text,target::text),0));
 if action='block' then
   insert into public.blocks values(uid,target,now()) on conflict do nothing;
   delete from public.follows where (follower_id=uid and following_id=target) or (follower_id=target and following_id=uid);
   delete from public.follow_requests where (requester_id=uid and target_id=target) or (requester_id=target and target_id=uid);return;
 elsif action='unblock' then delete from public.blocks where blocker_id=uid and blocked_id=target;return;end if;
 if public.is_blocked(uid,target) then raise exception 'Unavailable';end if;
 if action='follow' then
   select private_profile into priv from public.profiles where id=target and discoverable and deleted_at is null;
   if priv is null then raise exception 'Unavailable';end if;
   if priv then insert into public.follow_requests values(uid,target,now()) on conflict do nothing;
   else insert into public.follows values(uid,target,now()) on conflict do nothing;end if;
 elsif action='unfollow' then delete from public.follows where follower_id=uid and following_id=target;delete from public.follow_requests where requester_id=uid and target_id=target;
 elsif action='accept' then
   if exists(select 1 from public.follow_requests where requester_id=target and target_id=uid) then insert into public.follows values(target,uid,now()) on conflict do nothing;delete from public.follow_requests where requester_id=target and target_id=uid;end if;
 elsif action='reject' then delete from public.follow_requests where requester_id=target and target_id=uid;
 else raise exception 'Invalid action';end if;
end $$;
revoke all on function public.community_people,public.community_feed,public.community_requests,public.community_action from public;
grant execute on function public.community_people,public.community_feed,public.community_requests,public.community_action to authenticated;

-- Database-backed limiter works across serverless instances. Only the server can call it.
create function public.take_rate_limit(rate_key text,max_hits integer default 30) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;begin
 insert into public.rate_limits(key,window_at,hits) values(rate_key,date_trunc('minute',now()),1)
 on conflict(key) do update set hits=case when rate_limits.window_at=date_trunc('minute',now()) then rate_limits.hits+1 else 1 end,window_at=date_trunc('minute',now()) returning hits into n;
 return n<=max_hits;
end $$;
revoke all on function public.take_rate_limit from public,anon,authenticated;
grant execute on function public.take_rate_limit to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('diary-media','diary-media',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy media_owner_read on storage.objects for select to authenticated using(bucket_id='diary-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy media_owner_insert on storage.objects for insert to authenticated with check(bucket_id='diary-media' and (storage.foldername(name))[1]=(select auth.uid())::text and name ~ ('^'||(select auth.uid())::text||'/[0-9a-f-]{36}\.(jpeg|png|webp)$'));
-- No overwrite/delete from browser: published snapshots may reference older media.

-- Security-definer functions are never exposed to anon. Catalogs are the only anon-readable tables.
