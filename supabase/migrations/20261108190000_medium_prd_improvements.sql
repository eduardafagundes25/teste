alter table public.businesses
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists secondary_categories text[] not null default '{}';

create table if not exists public.business_gallery (
  id bigint generated always as identity primary key,
  business_id text not null references public.businesses(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists business_gallery_business_idx on public.business_gallery(business_id, sort_order);
alter table public.business_gallery enable row level security;

drop policy if exists "Public can read published business gallery" on public.business_gallery;
create policy "Public can read published business gallery"
  on public.business_gallery for select
  to anon, authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.status = 'published'
  ));

drop policy if exists "Owners can manage business gallery" on public.business_gallery;
create policy "Owners can manage business gallery"
  on public.business_gallery for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((auth.jwt()->'app_metadata'->>'role') = 'admin', false)
    or exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "Admins can moderate all businesses" on public.businesses;
create policy "Admins can moderate all businesses"
  on public.businesses for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can update all businesses" on public.businesses;
create policy "Admins can update all businesses"
  on public.businesses for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('business-images', 'business-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can view business images" on storage.objects;
create policy "Public can view business images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'business-images');

drop policy if exists "Owners can upload business images" on storage.objects;
create policy "Owners can upload business images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'business-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Owners can update business images" on storage.objects;
create policy "Owners can update business images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'business-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'business-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Owners can delete business images" on storage.objects;
create policy "Owners can delete business images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'business-images' and (storage.foldername(name))[1] = auth.uid()::text);
