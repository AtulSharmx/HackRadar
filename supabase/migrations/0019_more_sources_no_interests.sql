-- 0019_more_sources_no_interests.sql (30 Oct 2026)
-- 1. Sources: ETHGlobal and Hackster, plus KnowAFest (off by default). fetch_url may open only their list pages,
--    and KnowAFest's feed and event pages. Nothing else on those hosts.
alter table public.event_sources drop constraint if exists event_sources_source_check;
alter table public.event_sources add constraint event_sources_source_check
  check (source in ('devpost','unstop','devfolio','hack2skill','hackerearth','ethglobal','hackster','knowafest','community','manual'));

create or replace function public.fetch_url(url text, user_agent text)
returns table (status integer, content_type text, body text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (
       url ~ '^https://unstop\.com/robots\.txt$'
    or url ~ '^https://unstop\.com/api/public/opportunity/search-result\?[A-Za-z0-9=&_%.-]*$'
    or url ~ '^https://unstop\.com/api/public/competition/[0-9]+$'
    or url ~ '^https://devpost\.com/robots\.txt$'
    or url ~ '^https://devpost\.com/api/hackathons\?[A-Za-z0-9=&_%.-]*$'
    or url ~ '^https://api\.devfolio\.co/robots\.txt$'
    or url ~ '^https://hack2skill\.com/robots\.txt$'
    or url ~ '^https://hack2skill\.com/api/v1/innovator/public/event/public-list\?[A-Za-z0-9=&_%.-]*$'
    or url ~ '^https://www\.hackerearth\.com/robots\.txt$'
    or url ~ '^https://www\.hackerearth\.com/api/events/upcoming/$'
    or url ~ '^https://www\.knowafest\.com/robots\.txt$'
    or url ~ '^https://www\.knowafest\.com/explore/category/Hackathon$'
    or url ~ '^https://www\.knowafest\.com/feed\.xml$'
    or url ~ '^https://www\.knowafest\.com/event/[a-z0-9-]+$'
  ) then
    raise exception 'fetch_url: url not allowed: %', url;
  end if;
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '20000');
  return query
    select r.status::integer, r.content_type::text, r.content::text
    from extensions.http((
      'GET', url,
      array[extensions.http_header('User-Agent', user_agent)],
      null, null
    )::extensions.http_request) as r;
end $$;

revoke all on function public.fetch_url(text, text) from public, anon, authenticated;
grant execute on function public.fetch_url(text, text) to service_role;

-- 2. Every event says which platforms list it, so the Feed can mix them and filter by them.
alter table public.events add column if not exists sources text[] not null default '{}';
update public.events e
   set sources = s.list, updated_at = now()
  from (select event_id, array_agg(distinct source order by source) as list
          from public.event_sources group by event_id) s
 where s.event_id = e.id;

-- 3. The interests question is gone: old answers must not keep narrowing anyone's alerts.
update public.devices
   set prefs = prefs - 'themes',
       alert_filter = alert_filter - 'themes'
 where prefs ? 'themes' or alert_filter ? 'themes';
