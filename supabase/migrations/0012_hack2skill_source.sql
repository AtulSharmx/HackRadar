-- 0012_hack2skill_source.sql (Plan A5): event_sources.source accepts hack2skill.
alter table event_sources drop constraint event_sources_source_check;
alter table event_sources add constraint event_sources_source_check
  check (source in ('devpost','unstop','devfolio','hack2skill','manual'));
