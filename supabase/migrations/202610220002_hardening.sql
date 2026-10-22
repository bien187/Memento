-- Publish contents are immutable; archiving changes only the archive flag.
create function public.protect_book_snapshot() returns trigger language plpgsql set search_path='' as $$
begin
 if new.snapshot is distinct from old.snapshot or new.owner_id<>old.owner_id or new.book_id<>old.book_id or new.id<>old.id or new.number<>old.number or new.created_at<>old.created_at then
   raise exception 'Published versions are immutable';
 end if;
 return new;
end $$;
create trigger immutable_book_version before update on public.book_versions for each row execute function public.protect_book_snapshot();
create function public.archive_book_version(version_id uuid,value boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 update public.book_versions set archived=value where id=version_id and owner_id=auth.uid();
 if not found then raise exception 'Version not found';end if;
end $$;
revoke all on function public.archive_book_version from public;
grant execute on function public.archive_book_version to authenticated;

create function public.community_connections(kind text) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'username',p.username)),'[]'::jsonb)
 from public.profiles p where auth.uid() is not null and p.deleted_at is null and (
   kind='followers' and exists(select 1 from public.follows f where f.follower_id=p.id and f.following_id=auth.uid())
   or kind='following' and exists(select 1 from public.follows f where f.following_id=p.id and f.follower_id=auth.uid())
   or kind='blocked' and exists(select 1 from public.blocks b where b.blocked_id=p.id and b.blocker_id=auth.uid())
 );
$$;
revoke all on function public.community_connections from public;
grant execute on function public.community_connections to authenticated;

-- Validate cross-row ownership even for malicious client-supplied media arrays.
create function public.check_entry_media_owner() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.entry_media m where m.id=any(new.media_ids) and (m.owner_id<>new.owner_id or m.entry_id is distinct from new.id)) then raise exception 'Invalid entry media ownership';end if;
 return new;
end $$;
create trigger entry_media_ownership before insert or update on public.diary_entries for each row execute function public.check_entry_media_owner();

create function public.check_period_range() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.diary_entries e where e.period_id=new.id and e.deleted_at is null and (e.date<new.start_date or e.date>new.end_date)) then raise exception 'Period must include all entry dates';end if;
 return new;
end $$;
create trigger period_range before update on public.service_periods for each row execute function public.check_period_range();

-- No authenticated user may call internal trigger helpers directly.
revoke all on function public.protect_book_snapshot,public.check_entry_media_owner,public.check_period_range from public;

create function public.protect_media_path() returns trigger language plpgsql set search_path='' as $$
begin
 if old.storage_path is not null and (new.storage_path is distinct from old.storage_path or new.mime<>old.mime or new.id<>old.id or new.owner_id<>old.owner_id) then raise exception 'Uploaded media are immutable';end if;
 return new;
end $$;
create trigger immutable_media_path before update on public.entry_media for each row execute function public.protect_media_path();
revoke all on function public.protect_media_path from public;
