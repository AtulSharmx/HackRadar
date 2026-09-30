-- 0010_devfolio.sql (Plan A4)
-- events.source_verified: the platform itself verified this listing (Devfolio "verified").
-- Used by trust rules instead of inventing an organizer name the source doesn't give.
alter table public.events add column if not exists source_verified boolean not null default false;

-- fetch_url: also Devfolio's API robots.txt (the collector checks robots on every host it calls)
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

-- POST twin for Devfolio's search API. Exact URL and a fixed body shape only: not a general proxy.
create or replace function public.fetch_url_post(url text, body jsonb, user_agent text)
returns table (status integer, content_type text, body_text text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if url <> 'https://api.devfolio.co/api/search/hackathons' then
    raise exception 'fetch_url_post: url not allowed: %', url;
  end if;
  if (select array_agg(k order by k) from jsonb_object_keys(body) as k) <> array['from', 'size', 'type']
     or body->>'type' <> 'application_open'
     or jsonb_typeof(body->'from') <> 'number' or (body->>'from')::int not between 0 and 1000
     or jsonb_typeof(body->'size') <> 'number' or (body->>'size')::int not between 1 and 50 then
    raise exception 'fetch_url_post: body not allowed: %', body;
  end if;
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '20000');
  return query
    select r.status::integer, r.content_type::text, r.content::text
    from extensions.http((
      'POST', url,
      array[extensions.http_header('User-Agent', user_agent)],
      'application/json', body::text
    )::extensions.http_request) as r;
end $$;

revoke all on function public.fetch_url(text, text) from public, anon, authenticated;
grant execute on function public.fetch_url(text, text) to service_role;
revoke all on function public.fetch_url_post(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.fetch_url_post(text, jsonb, text) to service_role;
