-- 0018_hackerearth_community_sources.sql (launch audit, 12 Oct 2026)
-- 1. event_sources accepts 'hackerearth' (new adapter) and 'community' (approved submissions,
--    collector/community.py); without this their rows would fail to insert.
alter table public.event_sources drop constraint event_sources_source_check;
alter table public.event_sources add constraint event_sources_source_check
  check (source in ('devpost','unstop','devfolio','hack2skill','hackerearth','community','manual'));

-- 2. fetch_url: HackerEarth's robots.txt and its public upcoming-events list (the feed its own browser
--    extension uses). robots.txt allows it; the Terms (checked 12 Oct 2026) have no clause on automated
--    access. Exact URLs only, as for the other sources.
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
