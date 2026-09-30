-- Admin product management authorization.
create table if not exists public.admins (
  email text primary key,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
insert into public.admins(email) values ('admin@testt.local') on conflict do nothing;

drop policy if exists "Admins can read own admin record" on public.admins;
create policy "Admins can read own admin record" on public.admins for select to authenticated
using (lower(email)=lower(coalesce((select auth.jwt()->>'email'),'')));

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products" on public.products for select to anon, authenticated
using (active=true or exists (select 1 from public.admins a where lower(a.email)=lower(coalesce((select auth.jwt()->>'email'),''))));

drop policy if exists "Admins can insert products" on public.products;
create policy "Admins can insert products" on public.products for insert to authenticated
with check (exists (select 1 from public.admins a where lower(a.email)=lower(coalesce((select auth.jwt()->>'email'),''))));

drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products" on public.products for update to authenticated
using (exists (select 1 from public.admins a where lower(a.email)=lower(coalesce((select auth.jwt()->>'email'),''))))
with check (exists (select 1 from public.admins a where lower(a.email)=lower(coalesce((select auth.jwt()->>'email'),''))));

drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products" on public.products for delete to authenticated
using (exists (select 1 from public.admins a where lower(a.email)=lower(coalesce((select auth.jwt()->>'email'),''))));

create or replace function public.set_product_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end;
$$;
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products for each row execute function public.set_product_updated_at();
