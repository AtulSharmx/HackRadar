# Backend Schema: HackRadar

Sep 27, 2026 · @Atul Sharma

## Overview

The backend is one Supabase PostgreSQL database with 11 tables: 4 the app can touch and 7 only the collector uses.

Tables, who writes, who reads:

- events: collector writes; app reads. One row per real hackathon.
- event\_sources: collector only. Where each event was found (one event, many sources).
- event\_changes: collector writes; app reads. History of important field changes.
- devices: app writes and reads its own row; collector reads all. One row per installed app.
- saved\_events: app writes and reads its own rows; collector reads all.
- manual\_events: collector only in version 1 (I add rows in the Supabase dashboard); later filled by add-by-link.
- source\_runs: collector only. One row per source per run, for health checks.
- geocode\_cache: collector only. Address to coordinates.
- push\_tickets: collector only. Expo tickets waiting for a receipt check.
- pending\_digest: collector only. New matches held for quiet hours or digest mode.
- review\_queue: collector only. Possible duplicates and parse problems for me to check.

"Collector" means the Python job using the service key, which bypasses security rules. "App" means the Android app signed in anonymously, which is limited by row-level security.

## Relationships

Events sit at the centre; devices connect to events only through saved\_events, and deleting an event or a device cleans up everything linked to it.

- events 1 to many event\_sources (an event can be listed on Devpost and Unstop).
- events 1 to many event\_changes.
- devices many to many events, through saved\_events.
- devices 1 to many push\_tickets and pending\_digest.
- pending\_digest also points to events.
- devices.id is the same value as the Supabase auth user id (auth.users.id) of the anonymous sign-in.
- manual\_events is standalone; the manual adapter reads it and turns rows into normal events with source = 'manual'.
- review\_queue points to one or two events (the suspected duplicate pair) or holds raw data when parsing failed.
- source\_runs and geocode\_cache have no links; they are logs and lookups.

Delete behaviour: deleting an event removes its sources, changes, saves, digest rows and review items (on delete cascade). Deleting a device removes its saves, tickets and digest rows. Deleting the auth user deletes the device row too.

## SQL migration

This is the first migration file (supabase/migrations/0001\_init.sql); run it once with the Supabase CLI, and make every later change as a new numbered file.

```sql
-- 0001_init.sql : HackRadar core schema

-- keep updated_at correct on every update
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create table events (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null check (length(title) between 3 and 200),
  organizer             text check (length(organizer) <= 150),
  description_short     text check (length(description_short) <= 300),
  mode                  text check (mode in ('online','offline','hybrid')),
  venue_address         text check (length(venue_address) <= 300),
  city                  text,
  state                 text,
  lat                   double precision check (lat between -90 and 90),
  lng                   double precision check (lng between -180 and 180),
  location_approximate  boolean not null default false,
  registration_url      text not null check (registration_url ~* '^https?://'),
  event_url             text check (event_url ~* '^https?://'),
  registration_deadline timestamptz,
  start_date            timestamptz,
  end_date              timestamptz,
  themes                text[] not null default '{}',
  team_min              smallint check (team_min >= 1),
  team_max              smallint check (team_max >= team_min),
  solo_allowed          boolean,
  fee_amount            integer check (fee_amount >= 0),       -- INR; null = unknown, 0 = free
  prize_text            text check (length(prize_text) <= 200),
  prize_amount_inr      integer check (prize_amount_inr >= 0),
  prize_approximate     boolean not null default false,
  perks                 text[] not null default '{}',
  eligibility_text      text check (length(eligibility_text) <= 300),
  eligible_degrees      text[],
  eligible_years        smallint[],
  trust_label           text not null default 'check_details'
                        check (trust_label in ('trusted_source','check_details','warning','stale')),
  warnings              jsonb not null default '[]',          -- [{"code":"high_fee","text":"..."}]
  fingerprint           text,
  status                text not null default 'open' check (status in ('open','closed','stale')),
  first_seen_at         timestamptz not null default now(),
  last_checked_at       timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create trigger events_updated_at before update on events
  for each row execute function set_updated_at();

create table event_sources (
  source           text not null check (source in ('devpost','unstop','devfolio','manual')),
  source_event_id  text not null,
  event_id         uuid not null references events(id) on delete cascade,
  source_url       text,
  raw_hash         text,
  missing_runs     smallint not null default 0,
  last_seen_at     timestamptz not null default now(),
  primary key (source, source_event_id)
);

create table event_changes (
  id              bigint generated always as identity primary key,
  event_id        uuid not null references events(id) on delete cascade,
  changed_fields  text[] not null,
  old_values      jsonb,
  new_values      jsonb,
  changed_at      timestamptz not null default now(),
  notified        boolean not null default false
);

create table devices (
  id                   uuid primary key references auth.users(id) on delete cascade,
  expo_push_token      text unique,
  city                 text,
  state                text,
  lat_rounded          numeric(5,2),
  lng_rounded          numeric(5,2),
  prefs                jsonb not null default '{}',
  alert_filter         jsonb,
  alerts_enabled       boolean not null default true,
  quiet_start_min      smallint not null default 1380 check (quiet_start_min between 0 and 1439), -- 23:00
  quiet_end_min        smallint not null default 480  check (quiet_end_min between 0 and 1439),   -- 08:00
  digest_mode          boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create trigger devices_updated_at before update on devices
  for each row execute function set_updated_at();

create table saved_events (
  device_id  uuid not null references devices(id) on delete cascade,
  event_id   uuid not null references events(id) on delete cascade,
  status     text not null default 'interested' check (status in ('interested','registered')),
  saved_at   timestamptz not null default now(),
  primary key (device_id, event_id)
);

create table manual_events (
  id                uuid primary key default gen_random_uuid(),
  payload           jsonb not null,        -- same fields as events, filled by hand
  added_at          timestamptz not null default now(),
  confirmed         boolean not null default false
);

create table source_runs (
  id            bigint generated always as identity primary key,
  source        text not null,
  run_at        timestamptz not null default now(),
  events_found  integer not null default 0,
  new_events    integer not null default 0,
  duration_ms   integer,
  error_text    text
);

create table geocode_cache (
  address_key  text primary key,           -- lowercased, cleaned address
  lat          double precision,
  lng          double precision,
  approximate  boolean not null default false,
  created_at   timestamptz not null default now()
);

create table push_tickets (
  ticket_id  text primary key,
  device_id  uuid not null references devices(id) on delete cascade,
  kind       text not null check (kind in ('new_match','change','admin')),
  sent_at    timestamptz not null default now(),
  checked    boolean not null default false
);

create table pending_digest (
  device_id  uuid not null references devices(id) on delete cascade,
  event_id   uuid not null references events(id) on delete cascade,
  queued_at  timestamptz not null default now(),
  primary key (device_id, event_id)
);

create table review_queue (
  id          bigint generated always as identity primary key,
  reason      text not null check (reason in ('possible_duplicate','parse_error','user_report')),
  event_a     uuid references events(id) on delete cascade,
  event_b     uuid references events(id) on delete cascade,
  raw         jsonb,
  score       smallint,
  resolved    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- indexes
create index events_open_deadline_idx on events (status, registration_deadline);
create index events_updated_idx      on events (updated_at);
create index events_city_idx         on events (lower(city));
create index events_themes_idx       on events using gin (themes);
create index event_sources_event_idx on event_sources (event_id);
create index source_runs_recent_idx  on source_runs (source, run_at desc);
create index saved_events_event_idx  on saved_events (event_id);
create index push_tickets_open_idx   on push_tickets (checked, sent_at);
```

## Field rules and allowed values

The database checks the basics; the rules below are enforced in the collector and the app, and both must use the same lists.

Fixed value lists (keep in shared/constants.json):

- themes: ai\_ml, cybersecurity, web, mobile, data\_science, blockchain, iot\_hardware, open\_innovation, other
- degrees: bca, btech, bsc, mca, mtech, other
- warning codes: high\_fee, no\_organizer, date\_conflict, domain\_mismatch, social\_only
- change fields tracked: registration\_deadline, start\_date, venue\_address, city, mode, fee\_amount

Meaning of tricky fields:

- fee\_amount: rupees per team. null means the source did not say; 0 means the source said free. Never write 0 for unknown.
- prize\_amount\_inr: total prize pool in rupees; foreign amounts converted with a fixed config rate and prize\_approximate = true.
- registration\_deadline: stored in UTC; a date with no time means 23:59 IST that day.
- lat and lng on events: venue location. location\_approximate = true when it is the city centre.
- lat\_rounded and lng\_rounded on devices: rounded to 2 decimals (about 1 km). Never store raw GPS.
- status: open (deadline in future or unknown), closed (deadline passed), stale (missing from sources for 3 runs).
- fingerprint: SHA-256 of the tracked change fields, joined in a fixed order.

prefs (devices.prefs) shape:

```json
{
  "themes": ["ai_ml", "cybersecurity"],
  "modes": ["online", "offline", "hybrid"],
  "fee_max": 500,
  "degree": "bca",
  "year": 2,
  "max_km": 50,
  "hide_warnings": false
}
```

alert\_filter (devices.alert\_filter) shape, null means "use prefs":

```json
{
  "themes": ["ai_ml"],
  "modes": ["offline"],
  "fee_max": 0,
  "max_km": 50,
  "closing_within_days": null,
  "solo_only": false,
  "exclude_warnings": true
}
```

warnings (events.warnings) shape: a list of objects with code and a plain sentence, for example {"code": "high\_fee", "text": "Fee is ₹800 and no prize is listed"}.

## Row-level security

RLS is switched on for all 11 tables; only 4 get policies, so the other 7 are closed to the app by default.

Anonymous sign-in users in Supabase get the authenticated role, and auth.uid() returns their id. Anonymous sign-in must be switched on in the project's Auth settings.

```sql
-- 0002_rls.sql

alter table events          enable row level security;
alter table event_sources   enable row level security;
alter table event_changes   enable row level security;
alter table devices         enable row level security;
alter table saved_events    enable row level security;
alter table manual_events   enable row level security;
alter table source_runs     enable row level security;
alter table geocode_cache   enable row level security;
alter table push_tickets    enable row level security;
alter table pending_digest  enable row level security;
alter table review_queue    enable row level security;

-- events and change history: read-only for signed-in app users
create policy events_read on events
  for select to authenticated using (true);

create policy event_changes_read on event_changes
  for select to authenticated using (true);

-- devices: each app user sees and edits only its own row
create policy devices_select_own on devices
  for select to authenticated using (id = (select auth.uid()));
create policy devices_insert_own on devices
  for insert to authenticated with check (id = (select auth.uid()));
create policy devices_update_own on devices
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy devices_delete_own on devices
  for delete to authenticated using (id = (select auth.uid()));

-- saved events: only your own
create policy saved_select_own on saved_events
  for select to authenticated using (device_id = (select auth.uid()));
create policy saved_insert_own on saved_events
  for insert to authenticated with check (device_id = (select auth.uid()));
create policy saved_update_own on saved_events
  for update to authenticated
  using (device_id = (select auth.uid())) with check (device_id = (select auth.uid()));
create policy saved_delete_own on saved_events
  for delete to authenticated using (device_id = (select auth.uid()));

-- all other tables: no policy = no access for anon or authenticated.
-- the collector uses the service role key, which bypasses RLS.
```

RLS test checklist (run with the app's anon key after an anonymous sign-in; every line must fail or return nothing):

- [ ] Update any row in events.
- [ ] Insert into events.
- [ ] Select from source\_runs, geocode\_cache, push\_tickets, review\_queue.
- [ ] Select another device's row from devices.
- [ ] Insert a saved\_events row with someone else's device\_id.
- [ ] Select from events without signing in first (plain anon role).

## Key queries

Five queries do most of the work: app sync, collector upsert, closing and staling events, finding who to notify, and the health check.

1. App sync (JavaScript, supabase-js), pages of 500 rows:

```js
const { data, error } = await supabase
  .from('events')
  .select('*')
  .gt('updated_at', lastSyncIso)
  .order('updated_at', { ascending: true })
  .range(from, from + 499);
```

2. Collector upsert of one source link (the event row itself is inserted or updated first in Python after duplicate matching):

```sql
insert into event_sources (source, source_event_id, event_id, source_url, raw_hash, missing_runs, last_seen_at)
values (%(source)s, %(source_event_id)s, %(event_id)s, %(source_url)s, %(raw_hash)s, 0, now())
on conflict (source, source_event_id) do update
  set raw_hash = excluded.raw_hash,
      source_url = excluded.source_url,
      missing_runs = 0,
      last_seen_at = now();
```

3. End of each run: close passed deadlines and mark missing events stale:

```sql
update events set status = 'closed'
where status = 'open' and registration_deadline < now();

update event_sources set missing_runs = missing_runs + 1
where source = %(source)s and last_seen_at < %(run_started_at)s;

update events e set status = 'stale', trust_label = 'stale'
where e.status = 'open'
  and not exists (
    select 1 from event_sources s
    where s.event_id = e.id and s.missing_runs < 3
  );
```

4. Who to notify about changes (saved events with a new, unsent change):

```sql
select c.id as change_id, c.event_id, c.changed_fields, d.id as device_id, d.expo_push_token
from event_changes c
join saved_events s on s.event_id = c.event_id
join devices d on d.id = s.device_id
where c.notified = false
  and c.changed_fields && array['registration_deadline','venue_address','city']
  and d.expo_push_token is not null;
```

New-match alerts load this run's new events and all devices, then run the same match function the app uses, in Python.

5. Health check (sources with no events or only errors in the last 2 days):

```sql
select source
from source_runs
where run_at > now() - interval '2 days'
group by source
having max(events_found) = 0;
```

Also alert if a source has no rows at all in the last 2 days, which means the collector itself did not run.

## Retention, backups and migrations

Old logs are trimmed weekly, closed events are kept for a year (for recurring-event ideas later), and the free plan's missing backups are covered by a weekly export.

Retention (weekly cleanup job):

- source\_runs: keep 60 days.
- push\_tickets: delete when checked, or when older than 2 days.
- pending\_digest: delete once sent.
- event\_changes: keep 90 days.
- review\_queue: delete resolved items after 30 days.
- events with status closed or stale: keep 1 year, then delete (cascade removes their links).
- geocode\_cache: keep forever; it is small and saves Nominatim calls.
- devices with no push token and no update for 90 days: delete (reinstalled or abandoned apps).

Backups:

- Weekly GitHub Actions job runs pg\_dump with the database connection string (stored as a secret) and saves the file as a private workflow artifact.
- Test a restore into a second, temporary Supabase project once, so I know the backup actually works.

Migrations:

- Every schema change is a new file: 0003\_add\_x.sql, 0004\_..., never an edit to an old file.
- Apply with the Supabase CLI; after week 1, never change tables by hand in the dashboard.
- When a column changes meaning, update shared/constants.json, the collector and the app in the same commit.

Expected size: a few thousand events plus logs stays well under 50 MB, far below the free plan's 500 MB.
