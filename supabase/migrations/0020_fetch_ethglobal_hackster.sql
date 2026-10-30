-- 0020_fetch_ethglobal_hackster.sql (30 Oct 2026)
-- 0019 allowed these two as sources but its fetch_url list missed them. Only their robots.txt and list page open.
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
    or url ~ '^https://ethglobal\.com/robots\.txt$'
    or url ~ '^https://ethglobal\.com/events$'
    or url ~ '^https://www\.hackster\.io/robots\.txt$'
    or url ~ '^https://www\.hackster\.io/contests$'
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
