-- WM 2026 Tippspiel – Supabase-Schema
-- Einmalig im Supabase SQL-Editor ausführen (Dashboard -> SQL Editor -> New query).

-- ---------- Tabellen ----------

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 2 and 30),
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_name_unique on public.profiles (lower(name));

create table if not exists public.matches (
  ext_id          text primary key,
  home_team       text not null,
  away_team       text not null,
  kickoff_utc     timestamptz not null,
  stage           text,
  group_name      text,
  venue           text,
  status          text not null default 'SCHEDULED'
                  check (status in ('SCHEDULED', 'LIVE', 'FINISHED', 'CANCELLED')),
  home_score      int check (home_score between 0 and 99),
  away_score      int check (away_score between 0 and 99),
  manual_override boolean not null default false
);

create index if not exists matches_kickoff on public.matches (kickoff_utc);

create table if not exists public.tips (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  match_ext_id text not null references public.matches (ext_id) on delete cascade on update cascade,
  home_tip     int not null check (home_tip between 0 and 99),
  away_tip     int not null check (away_tip between 0 and 99),
  updated_at   timestamptz not null default now(),
  primary key (user_id, match_ext_id)
);

-- ---------- Trigger ----------

-- Die erste registrierte Person wird Admin; alle weiteren nicht.
-- Der Trigger überschreibt is_admin immer, damit es niemand selbst setzen kann.
create or replace function public.set_first_admin()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.is_admin := not exists (select 1 from public.profiles);
  return new;
end;
$$;

drop trigger if exists profiles_first_admin on public.profiles;
create trigger profiles_first_admin
  before insert on public.profiles
  for each row execute function public.set_first_admin();

create or replace function public.touch_tip()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tips_touch on public.tips;
create trigger tips_touch
  before insert or update on public.tips
  for each row execute function public.touch_tip();

-- ---------- Row Level Security ----------

alter table public.profiles enable row level security;
alter table public.matches  enable row level security;
alter table public.tips     enable row level security;

-- Hilfsfunktion: ist der eingeloggte Nutzer Admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

-- Wer hat bei einem Spiel schon getippt? Gibt bewusst NUR die Namen zurück
-- (keine Tipp-Werte), damit vor dem Anpfiff niemand abschreiben kann.
create or replace function public.tippers(p_match_ext_id text)
returns table(name text)
language sql
security definer set search_path = public
stable
as $$
  select p.name
  from public.tips t
  join public.profiles p on p.id = t.user_id
  where t.match_ext_id = p_match_ext_id
  order by p.name;
$$;

grant execute on function public.tippers(text) to anon, authenticated;

-- pgcrypto für das Hashen neuer Passwörter (in Supabase im Schema "extensions")
create extension if not exists pgcrypto with schema extensions;

-- Admin-Passwort-Reset.
-- Bestehende Passwörter lassen sich NICHT anzeigen – sie sind sicher gehasht
-- gespeichert (Einbahnstraße). Der Admin kann hier nur ein NEUES Passwort
-- vergeben und es der Person mitteilen. Profil, Tipps und Punkte bleiben
-- unverändert, da ausschließlich das Passwort in auth.users geändert wird.
create or replace function public.admin_reset_password(p_user_id uuid, p_new_password text)
returns void
language plpgsql
security definer set search_path = public, extensions
as $$
begin
  if not public.is_admin() then
    raise exception 'Nur Admins dürfen Passwörter zurücksetzen';
  end if;
  if p_new_password is null or char_length(p_new_password) < 6 then
    raise exception 'Passwort muss mindestens 6 Zeichen haben';
  end if;
  update auth.users
    set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
        updated_at = now()
    where id = p_user_id;
  if not found then
    raise exception 'Nutzer nicht gefunden';
  end if;
end;
$$;

revoke all on function public.admin_reset_password(uuid, text) from public, anon;
grant execute on function public.admin_reset_password(uuid, text) to authenticated;

-- Profile: Namen sind für alle sichtbar (Rangliste), jeder legt nur sein eigenes an
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (true);

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

-- Spiele: für alle lesbar; schreiben darf nur der Admin
-- (die GitHub Action nutzt den Service-Role-Key und umgeht RLS ohnehin)
drop policy if exists matches_select on public.matches;
create policy matches_select on public.matches
  for select using (true);

drop policy if exists matches_admin_insert on public.matches;
create policy matches_admin_insert on public.matches
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists matches_admin_update on public.matches;
create policy matches_admin_update on public.matches
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Tipps:
--  * eigene Tipps immer sichtbar, fremde erst ab Anpfiff (niemand kann abschreiben)
--  * tippen/ändern nur den eigenen Tipp und nur vor Anpfiff
drop policy if exists tips_select on public.tips;
create policy tips_select on public.tips
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.matches m
      where m.ext_id = match_ext_id and m.kickoff_utc <= now()
    )
  );

drop policy if exists tips_insert on public.tips;
create policy tips_insert on public.tips
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.ext_id = match_ext_id and m.kickoff_utc > now()
    )
  );

drop policy if exists tips_update on public.tips;
create policy tips_update on public.tips
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.ext_id = match_ext_id and m.kickoff_utc > now()
    )
  );
