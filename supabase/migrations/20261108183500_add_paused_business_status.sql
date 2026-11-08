alter table public.businesses
  drop constraint if exists businesses_status_check;

alter table public.businesses
  add constraint businesses_status_check
  check (status in ('draft', 'published', 'paused'));
