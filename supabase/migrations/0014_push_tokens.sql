-- 0014_push_tokens.sql: B3 push notifications (docs/superpowers/specs/2026-10-01-b3-push-design.md).

-- One row per phone: an account signed in on two phones has two tokens. devices.expo_push_token (0001)
-- held only one and stays unused.
create table if not exists public.push_tokens (
  expo_push_token text primary key
    check (expo_push_token ~ '^Expo(nent)?PushToken\[[^\]]{1,180}\]$'),
  user_id         uuid not null references public.devices(id) on delete cascade,
  platform        text not null default 'android' check (platform in ('android', 'ios')),
  updated_at      timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

-- Nobody reads or writes tokens directly: RLS on, no policies, no grants. The app goes through the
-- function below; the collector uses the service key.
alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;

-- Save this phone's token for the signed-in user. A token already saved for another user moves to the
-- caller: the same phone logged out to a new guest, or signed in to another account.
create or replace function public.register_push_token(p_token text, p_platform text default 'android')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first';
  end if;
  insert into devices (id) values (auth.uid()) on conflict (id) do nothing;
  insert into push_tokens (expo_push_token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (expo_push_token)
  do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;
revoke all on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

-- A receipt that says DeviceNotRegistered must find the token to delete.
alter table public.push_tickets add column if not exists token text;
