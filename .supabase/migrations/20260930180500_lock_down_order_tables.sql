drop policy if exists "No direct public access to orders" on public.orders;
create policy "No direct public access to orders" on public.orders for all to anon,authenticated using(false) with check(false);
drop policy if exists "No direct public access to order items" on public.order_items;
create policy "No direct public access to order items" on public.order_items for all to anon,authenticated using(false) with check(false);