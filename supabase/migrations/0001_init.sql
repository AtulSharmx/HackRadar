-- 0001_init.sql : HackRadar core schema

-- keep updated_at correct on every update
create or replace function set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
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
