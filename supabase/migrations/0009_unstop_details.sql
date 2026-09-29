-- 0009_unstop_details.sql
-- A1: Unstop detail enrichment.
-- events.rounds: [{title, start, end}] from the source's round list (registration windows excluded).
-- event_sources.source_updated_at: the source's own "updated_at" at the time we last read its detail,
-- so details are re-fetched only when the source changed.
alter table public.events add column if not exists rounds jsonb not null default '[]';
alter table public.event_sources add column if not exists source_updated_at text;

-- fetch_url: add Unstop's competition detail endpoint (numeric id only)
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
