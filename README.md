# Rafsanjan Mafia

Production-oriented event landing page and seat reservation system.

## Stack
Static HTML/CSS/JS frontend + Supabase Postgres/RLS/Auth/Realtime + Edge Function `create-reservation`.

## Setup
1. Apply `supabase/migrations/20261003190000_raf_sanjan_mafia_event_booking.sql`.
2. Create a Supabase Auth email/password admin and add the same email to `public.admins`.
3. Configure event/contact data from `admin.html`.
4. Deploy the Edge Function when moving projects.
5. Put the official logo at `assets/logo.png`.

The browser contains only a Supabase publishable key. No service-role/database/JWT secret is committed. The active-seat partial unique index prevents double booking at the database layer.