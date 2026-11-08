create table if not exists public.business_interaction_dedup (
  visitor_id text not null,
  business_id text not null references public.businesses(id) on delete cascade,
  type text not null check (type in ('view', 'whatsapp', 'instagram', 'location', 'order', 'phone')),
  bucket bigint not null,
  created_at timestamptz not null default now(),
  primary key (visitor_id, business_id, type, bucket)
);

alter table public.business_interaction_dedup enable row level security;

drop policy if exists "Public can add interactions" on public.business_interactions;
drop policy if exists "Public can read interactions" on public.business_interactions;

revoke all on public.business_interactions from anon, authenticated;
revoke all on public.business_interaction_dedup from anon, authenticated;

create or replace function public.record_business_interaction(
  p_business_id text,
  p_type text,
  p_visitor_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_bucket bigint := floor(extract(epoch from now()) / 30);
begin
  if p_type not in ('view', 'whatsapp', 'instagram', 'location', 'order', 'phone')
    or p_visitor_id is null
    or p_visitor_id !~ '^[a-zA-Z0-9_-]{16,128}$'
    or not exists (
      select 1 from public.businesses
      where id = p_business_id and status = 'published'
    )
  then
    return false;
  end if;

  insert into public.business_interaction_dedup (visitor_id, business_id, type, bucket)
  values (p_visitor_id, p_business_id, p_type, current_bucket)
  on conflict do nothing;

  if not found then
    return false;
  end if;

  insert into public.business_interactions (business_id, type)
  values (p_business_id, p_type);
  return true;
end;
$$;

create or replace function public.get_public_business_interaction_counts()
returns table (business_id text, type text, interaction_count bigint)
language sql
security definer
stable
set search_path = public
as $$
  select i.business_id, i.type, count(*)::bigint
  from public.business_interactions i
  join public.businesses b on b.id = i.business_id
  where b.status = 'published'
  group by i.business_id, i.type;
$$;

create or replace function public.get_my_business_interactions()
returns table (business_id text, type text, created_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select i.business_id, i.type, i.created_at
  from public.business_interactions i
  join public.businesses b on b.id = i.business_id
  where b.owner_id = auth.uid();
$$;

revoke all on function public.record_business_interaction(text, text, text) from public, anon, authenticated;
revoke all on function public.get_public_business_interaction_counts() from public, anon, authenticated;
revoke all on function public.get_my_business_interactions() from public, anon;
grant execute on function public.record_business_interaction(text, text, text) to anon, authenticated;
grant execute on function public.get_public_business_interaction_counts() to anon, authenticated;
grant execute on function public.get_my_business_interactions() to authenticated;
