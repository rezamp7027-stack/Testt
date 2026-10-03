alter table public.events
  add column if not exists event_type text not null default 'MAFIA',
  add column if not exists registration_mode text not null default 'INDIVIDUAL',
  add column if not exists team_size integer not null default 1;
alter table public.reservations alter column seat_id drop not null;
alter table public.events drop constraint if exists events_event_type_check;
alter table public.events add constraint events_event_type_check check (event_type in ('MAFIA','GOL_YA_POOCH','PANTOMIME','SECRET_HITLER'));
alter table public.events drop constraint if exists events_registration_mode_check;
alter table public.events add constraint events_registration_mode_check check (registration_mode in ('INDIVIDUAL','TEAM'));
alter table public.events drop constraint if exists events_team_size_check;
alter table public.events add constraint events_team_size_check check (team_size between 1 and 10);
create table if not exists public.teams (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade,
 reservation_id uuid unique references public.reservations(id) on delete cascade, team_name text not null, captain_name text not null,
 captain_phone text not null, status text not null default 'PENDING', created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), constraint teams_status_check check(status in ('PENDING','CONFIRMED','CANCELLED')),
 constraint teams_name_check check(length(trim(team_name)) between 2 and 80), constraint teams_captain_name_check check(length(trim(captain_name)) between 2 and 120),
 constraint teams_phone_check check(captain_phone ~ '^\+?[0-9]{7,15}$'));
create unique index if not exists teams_event_name_key on public.teams(event_id,lower(team_name));
create index if not exists teams_event_status_idx on public.teams(event_id,status);
create table if not exists public.team_members (
 id uuid primary key default gen_random_uuid(), team_id uuid not null references public.teams(id) on delete cascade,
 member_name text not null, member_order integer not null, created_at timestamptz not null default now(),
 constraint team_members_name_check check(length(trim(member_name)) between 2 and 120),
 constraint team_members_order_check check(member_order between 1 and 10));
create unique index if not exists team_members_order_key on public.team_members(team_id,member_order);
create index if not exists team_members_team_idx on public.team_members(team_id);
create or replace function public.validate_reservation() returns trigger language plpgsql set search_path=public as $$
declare s public.seats; e public.events;
begin
 select * into e from public.events where id=new.event_id;
 if not found or e.status <> 'PUBLISHED' then raise exception 'EVENT_NOT_AVAILABLE'; end if;
 if e.registration_mode='INDIVIDUAL' then
   if new.seat_id is null then raise exception 'SEAT_REQUIRED'; end if;
   select * into s from public.seats where id=new.seat_id and event_id=new.event_id for update;
   if not found then raise exception 'SEAT_NOT_FOUND'; end if;
   if s.status='DISABLED' then raise exception 'SEAT_DISABLED'; end if;
   if e.capacity < s.seat_number then raise exception 'SEAT_OUTSIDE_CAPACITY'; end if;
 elsif new.seat_id is not null then raise exception 'TEAM_RESERVATION_CANNOT_HAVE_SEAT'; end if;
 return new;
end $$;
create or replace function public.sync_seat_reservation_status() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='INSERT' then
  if new.seat_id is not null then update public.seats set status='RESERVED',updated_at=now() where id=new.seat_id and status<>'DISABLED'; end if; return new;
 end if;
 if tg_op='DELETE' then
  if old.seat_id is not null then update public.seats set status=case when status='DISABLED' then 'DISABLED' else 'AVAILABLE' end,updated_at=now()
   where id=old.seat_id and not exists(select 1 from public.reservations r where r.seat_id=old.seat_id and r.status in ('PENDING','CONFIRMED')); end if; return old;
 end if;
 if new.seat_id is distinct from old.seat_id then
  if old.seat_id is not null then update public.seats set status=case when status='DISABLED' then 'DISABLED' else 'AVAILABLE' end,updated_at=now()
   where id=old.seat_id and not exists(select 1 from public.reservations r where r.seat_id=old.seat_id and r.status in ('PENDING','CONFIRMED') and r.id<>new.id); end if;
  if new.seat_id is not null and new.status in ('PENDING','CONFIRMED') then update public.seats set status='RESERVED',updated_at=now() where id=new.seat_id and status<>'DISABLED'; end if;
 elsif new.seat_id is not null and old.status in ('PENDING','CONFIRMED') and new.status='CANCELLED' then
  update public.seats set status=case when status='DISABLED' then 'DISABLED' else 'AVAILABLE' end,updated_at=now()
  where id=new.seat_id and not exists(select 1 from public.reservations r where r.seat_id=new.seat_id and r.status in ('PENDING','CONFIRMED') and r.id<>new.id);
 end if; return new;
end $$;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
create policy "Public can read confirmed teams" on public.teams for select to anon,authenticated using(status='CONFIRMED');
create policy "Public can read confirmed team members" on public.team_members for select to anon,authenticated using(exists(select 1 from public.teams t where t.id=team_id and t.status='CONFIRMED'));
create policy "Admins can read teams" on public.teams for select to authenticated using(exists(select 1 from public.admins a where lower(a.email)=lower((select auth.jwt()->>'email'))));
create policy "Admins can update teams" on public.teams for update to authenticated using(exists(select 1 from public.admins a where lower(a.email)=lower((select auth.jwt()->>'email')))) with check(exists(select 1 from public.admins a where lower(a.email)=lower((select auth.jwt()->>'email'))));
create policy "Admins can delete teams" on public.teams for delete to authenticated using(exists(select 1 from public.admins a where lower(a.email)=lower((select auth.jwt()->>'email'))));
create policy "Admins can insert teams" on public.teams for insert to authenticated with check(exists(select 1 from public.admins a where lower(a.email)=lower((select auth.jwt()->>'email'))));
create policy "Admins can read team members" on public.team_members for select to authenticated using(exists(select 1 from public.admins a where lower(a.email)=lower((select auth.jwt()->>'email'))));
create policy "Admins can update team members" on public.team_members for update to authenticated using(exists(select 1 from public.admins a where lower(a.email)=lower((select auth.jwt()->>'email')))) with check(exists(select 1 from public.admins a where lower(a.email)=lower((select auth.jwt()->>'email'))));
create policy "Admins can delete team members" on public.team_members for delete to authenticated using(exists(select 1 from public.admins a where lower(a.email)=lower((select auth.jwt()->>'email'))));
create policy "Admins can insert team members" on public.team_members for insert to authenticated with check(exists(select 1 from public.admins a where lower(a.email)=lower((select auth.jwt()->>'email'))));
create policy "Admins can select all events" on public.events for select to authenticated using(exists(select 1 from public.admins a where lower(a.email)=lower((select auth.jwt()->>'email'))));