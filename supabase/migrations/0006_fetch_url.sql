-- 0006_fetch_url.sql
-- The collector runs on GitHub Actions, whose IP range Unstop and Devpost block. Supabase's egress is
-- allowed, so page fetches go through this function. Requests stay honest: named User-Agent,
-- robots.txt checked by the collector, same slow rate. Service key only.
--
-- Guard rails: https only, fixed host allowlist (not an open proxy), 20 s timeout.

create extension if not exists http with schema extensions;

create or replace function public.fetch_url(url text, user_agent text)
returns table (status integer, content_type text, body text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if url !~ '^https://(www\.)?(unstop\.com|devpost\.com)/' then
    raise exception 'fetch_url: host not allowed: %', url;
  end if;
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '20000');
  return query
    select r.status, r.content_type, r.content
    from extensions.http((
      'GET', url,
      array[extensions.http_header('User-Agent', user_agent)],
      null, null
    )::extensions.http_request) as r;
end $$;

revoke all on function public.fetch_url(text, text) from public, anon, authenticated;
grant execute on function public.fetch_url(text, text) to service_role;
