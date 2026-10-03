create table if not exists public.users(id uuid primary key default gen_random_uuid(),full_name text not null,phone text not null,created_at timestamptz default now(),updated_at timestamptz default now());create unique index if not exists users_phone_key on public.users(phone);create table if not exists public.events(id uuid primary key default gen_random_uuid(),title text not null default 'Rafsanjan Mafia',persian_title text not null default 'رفسنجان مافیا',description text not null default 'بازی شروع می‌شود. اعتماد تمام می‌شود.',event_date date,start_time time,location text not null default 'رفسنجان',price numeric not null default 0,capacity int not null default 10,duration_minutes int not null default 180,status text not null default 'DRAFT',banner_image_url text default '',logo_url text default 'assets/logo.png',contact_phone text default '',instagram text default '',telegram text default '',created_at timestamptz default now(),updated_at timestamptz default now());create table if not exists public.seats(id uuid primary key default gen_random_uuid(),event_id uuid not null references public.events(id) on delete cascade,seat_number int not null,status text not null default 'AVAILABLE',created_at timestamptz default now(),updated_at timestamptz default now(),unique(event_id,seat_number));create table if not exists public.reservations(id uuid primary key default gen_random_uuid(),reservation_code text unique not null,event_id uuid not null references public.events(id) on delete cascade,seat_id uuid not null references public.seats(id),user_id uuid references public.users(id),full_name text not null,phone text not null,guest_count int not null default 1,notes text default '',status text not null default 'PENDING',created_at timestamptz default now(),updated_at timestamptz default now());create unique index if not exists reservations_active_seat_key on public.reservations(event_id,seat_id) where status in('PENDING','CONFIRMED');create or replace function public.is_event_admin() returns boolean language sql stable set search_path=public as $$select exists(select 1 from public.admins where lower(email)=lower((select auth.jwt()->>'email')));$$;alter table public.users enable row level security;alter table public.events enable row level security;alter table public.seats enable row level security;alter table public.reservations enable row level security;create policy "public events" on public.events for select to anon,authenticated using(status='PUBLISHED' or (select public.is_event_admin()));create policy "admin events insert" on public.events for insert to authenticated with check((select public.is_event_admin()));create policy "admin events update" on public.events for update to authenticated using((select public.is_event_admin())) with check((select public.is_event_admin()));create policy "admin events delete" on public.events for delete to authenticated using((select public.is_event_admin()));create policy "public seats" on public.seats for select to anon,authenticated using(exists(select 1 from public.events e where e.id=event_id and(e.status='PUBLISHED' or(select public.is_event_admin()))));create policy "admin seats insert" on public.seats for insert to authenticated with check((select public.is_event_admin()));create policy "admin seats update" on public.seats for update to authenticated using((select public.is_event_admin())) with check((select public.is_event_admin()));create policy "admin seats delete" on public.seats for delete to authenticated using((select public.is_event_admin()));create policy "admin reservations select" on public.reservations for select to authenticated using((select public.is_event_admin()));create policy "admin reservations update" on public.reservations for update to authenticated using((select public.is_event_admin())) with check((select public.is_event_admin()));create policy "admin reservations delete" on public.reservations for delete to authenticated using((select public.is_event_admin()));create policy "admin users" on public.users for select to authenticated using((select public.is_event_admin()));insert into public.events(title,persian_title,location,capacity,status) select 'Rafsanjan Mafia','رفسنجان مافیا','رفسنجان',10,'PUBLISHED' where not exists(select 1 from public.events);
create index if not exists reservations_seat_id_idx on public.reservations(seat_id);
create index if not exists reservations_user_id_idx on public.reservations(user_id);

create or replace function public.seed_event_seats() returns trigger language plpgsql set search_path=public as $$
begin
  if tg_op='UPDATE' and new.capacity < (select coalesce(max(seat_number),0) from public.seats where event_id=new.id) then
    raise exception 'CAPACITY_BELOW_EXISTING_SEAT';
  end if;
  for i in 1..new.capacity loop
    insert into public.seats(event_id,seat_number) values(new.id,i)
    on conflict(event_id,seat_number) do nothing;
  end loop;
  return new;
end $$;

create or replace function public.validate_reservation() returns trigger language plpgsql set search_path=public as $$
declare s public.seats; e public.events;
begin
  select * into s from public.seats where id=new.seat_id and event_id=new.event_id for update;
  if not found then raise exception 'SEAT_NOT_FOUND'; end if;
  select * into e from public.events where id=new.event_id;
  if not found or e.status<>'PUBLISHED' then raise exception 'EVENT_NOT_AVAILABLE'; end if;
  if s.status='DISABLED' then raise exception 'SEAT_DISABLED'; end if;
  if s.seat_number>e.capacity then raise exception 'SEAT_OUTSIDE_CAPACITY'; end if;
  return new;
end $$;

create or replace function public.sync_seat_status() returns trigger language plpgsql set search_path=public as $$
begin
  if tg_op='INSERT' then
    update public.seats set status='RESERVED',updated_at=now() where id=new.seat_id and status<>'DISABLED';
  elsif tg_op='DELETE' or (old.status in('PENDING','CONFIRMED') and new.status='CANCELLED') then
    update public.seats set status='AVAILABLE',updated_at=now()
    where id=coalesce(new.seat_id,old.seat_id) and status<>'DISABLED'
      and not exists(select 1 from public.reservations r where r.seat_id=coalesce(new.seat_id,old.seat_id) and r.status in('PENDING','CONFIRMED') and r.id<>coalesce(new.id,old.id));
  end if;
  return coalesce(new,old);
end $$;

drop trigger if exists seed_event_seats on public.events;
create trigger seed_event_seats after insert or update of capacity on public.events for each row execute function public.seed_event_seats();
drop trigger if exists validate_reservation on public.reservations;
create trigger validate_reservation before insert on public.reservations for each row execute function public.validate_reservation();
drop trigger if exists sync_seat_status on public.reservations;
create trigger sync_seat_status after insert or update or delete on public.reservations for each row execute function public.sync_seat_status();

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='seats') then
    alter publication supabase_realtime add table public.seats;
  end if;
end $$;
