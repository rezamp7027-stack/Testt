-- Fix phone validation regex and preserve the unique phone key for reservation upserts.
alter table public.users drop constraint if exists users_phone_check;
alter table public.users add constraint users_phone_check check (phone ~ '^\+?[0-9]{7,15}$');
create unique index if not exists users_phone_key on public.users(phone);

alter table public.reservations drop constraint if exists reservations_phone_check;
alter table public.reservations add constraint reservations_phone_check check (phone ~ '^\+?[0-9]{7,15}$');
