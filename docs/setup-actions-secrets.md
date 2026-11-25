# Collector setup: GitHub secrets, migration 0022, first run (P0, 25 Nov 2026)

The collector runs on GitHub Actions every 3 hours. It needs 5 secrets to save events and to reach you on
Telegram. Do these steps in order:

1. Add the 5 secrets in GitHub.
2. Run the workflow once by hand, to see that the secrets work.
3. Apply migration 0022 in Supabase, and check the database's monthly data use.
4. Merge P0, then run the workflow by hand once more.
5. The next morning, check that the 9 am report arrives on Telegram.

## 1. The 5 secrets

No value is written here, or anywhere in the repo. Your local `.env` should already have the first four;
copy them from there. The table says where each one comes from if you need it again.

| Secret | What it is | Where the value comes from |
|---|---|---|
| `SUPABASE_URL` | The address of the HackRadar database | Supabase → the HackRadar project → Project Settings → Data API (called API on older pages) → Project URL. Only the address that ends in `.supabase.co`, with nothing after it. |
| `SUPABASE_SERVICE_ROLE_KEY` | The collector's master key to the database. It skips all row-level security, so it never goes into the app, a file or a chat. | Supabase → Project Settings → API Keys → Legacy API Keys → `service_role` (Reveal, then Copy). |
| `TELEGRAM_BOT_TOKEN` | Lets the collector write as your HackRadar bot | Telegram → @BotFather → `/mybots` → your bot → API Token. |
| `TELEGRAM_CHAT_ID` | Which chat the bot writes to: your own chat with the bot | Send your bot any message, then open `https://api.telegram.org/bot<token>/getUpdates` in your browser, with your bot token in place of `<token>`. The number after `"chat":{"id":` is the chat id. |
| `HACKRADAR_CONTACT` | Sent with every request the collector makes, so a platform can reach you | An email address or a web page that you are happy for platforms to see, for example this repo's GitHub page. It isn't really secret, but it lives with the others. |

What happens when one is missing:
- A Supabase secret missing or wrong: the run fails (red cross) and saves nothing. The log says
  `SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing`, or shows a 401 error for a wrong key.
- A Telegram secret missing: the run still goes green, but you hear nothing: no alerts, no 9 am report,
  not even "run failed". The messages are printed into the run's log instead, and this repo is public, so
  anyone can read that log (report notes that users typed included). Set both.
- `HACKRADAR_CONTACT` missing: the run works; requests just carry no contact.

## 2. Add them in GitHub

1. Open the repo on GitHub (github.com/AtulSharmx/HackRadar) on a laptop.
2. Settings (the last tab at the top) → in the left menu, Secrets and variables → Actions.
3. On the Secrets tab, under Repository secrets, click **New repository secret**.
4. Name: exactly as in the table above, in capital letters. Secret: paste the value, with no quotes and no
   space or empty line at the end. Click **Add secret**.
5. Repeat for all 5.

You should now see the 5 names under Repository secrets. GitHub never shows a value again; to change one,
click its pencil icon and paste the new value. Don't put them under Variables or under an Environment: the
workflow reads repository secrets only.

## 3. Apply migration 0022 (before merging P0)

Why: P0 makes the collector run every 3 hours (later maybe hourly). Today's rule (migration 0015) hides an
event as "stale" once its source has missed it in 3 runs. With runs every 6 h that was 18 hours; with
faster runs it would be only 9 hours (or 3 hourly), so an event that a platform leaves out of its list for a
few hours would drop out of the Feed.
Migration 0022 hides an event only when it hasn't been seen for 12 hours **and** was missed in 3 runs (or,
as before, when nothing has listed it for 3 days). It also adds a safety brake: if one run would hide more
than 30% of the open events, it hides none and you get a "Data blow-up" alert on Telegram.

It is safe to apply now: the collector on `main` works with 0022 as it is.

1. Check GitHub → Actions that no `collect` run is going on (a yellow dot). The migration replaces the
   function a run calls at its end.
2. Supabase → the HackRadar project → SQL Editor → New query.
3. In VS Code, open `supabase/migrations/0022_stale_hourly_brake.sql` from the P0 branch, select all, copy,
   and paste it into the query.
4. Click **Run**. You should see "Success. No rows returned".
5. Check it, in a new query. Both only read:
   ```sql
   select pg_get_function_result('public.end_of_run(text[], timestamptz)'::regprocedure);
   ```
   should show `TABLE(closed_count integer, stale_count integer, stale_blocked integer)`, and
   ```sql
   select has_function_privilege('anon', 'public.end_of_run(text[], timestamptz)', 'execute');
   ```
   should show `false` (the app's public key can't call it).

Don't run `end_of_run` yourself: it changes data. If the next run fails with "Could not find the function
public.end_of_run", run `notify pgrst, 'reload schema';` once in the SQL Editor and run the workflow again.

### Check the data use too

The project is on Supabase's free plan, which allows 5 GB of data out (egress) a month. Going over it can
get the project restricted, and that takes the app down for every user. Each collector run reads the events
table, and every source page comes back through the database: hourly runs were estimated at 3–7 GB a month,
too close to the limit. So P0 runs every 3 hours (8 runs a day, about 1–2.5 GB a month by the same estimate).

A week after the merge, measure it:
1. Supabase → your organization → Usage → pick the HackRadar project → Egress, for the last 7 days.
2. Multiply by 4 for a month. Write the number in `docs/TRD.md`, in the "Supabase egress, collector" row.
3. Under 1.2 GB a month: hourly runs would fit (about 3× that). Change the cron in
   `.github/workflows/collect.yml` from `47 */3 * * *` to `47 * * * *`. Otherwise keep every 3 hours.

Don't go back to the old `23 */6 * * *`: it never runs in the 9 o'clock hour, so the daily report would stop.

Then merge P0. Scheduled runs always use the workflow on `main`, so the new schedule starts with the merge.

## 4. Run the workflow by hand

Do this once after adding the secrets, and once more right after merging P0.

1. GitHub → the repo → Actions → **collect** in the left list.
2. **Run workflow** (on the right) → keep Branch: main → the green **Run workflow** button.
3. Refresh after a few seconds: the new run is at the top. It takes a few minutes.

A run started by hand fetches every source. Scheduled runs fetch ETHGlobal and dev.events (the heavy ones)
only every 6 hours: at 00:17, 06:17, 12:17 and 18:17 IST.

**A green run:** a green tick next to the run. Inside, the step "Run collector" has a tick and "Alert on
failure" is skipped. The "Run collector" log has one line per source, then the end of the run, like this
(your numbers will differ):

```
unstop: fetched 182, kept 150, new 2
devfolio: fetched 25, kept 23, new 0
...
changes recorded: 4, closed: 1, stale: 0
...
health alerts sent: 0
daily report sent: False
```

- `daily report sent: False` is normal, except in the 9 o'clock IST hour.
- A source line that ends in `ERROR ...` means only that source failed this time. The run stays green
  because the other sources were saved. If it lasts 48 hours, Telegram tells you.
- On a scheduled run, `skipped this hour (every 6 h): devevents, ethglobal` is normal.

**A red run:** the whole run failed. If the Telegram secrets are right, Telegram gets
"🚨 HackRadar collector poora fail ho gaya (koi source save nahi hua). Logs: ..." with a link. Open the
run, click the red step and read the last lines.

## 5. The 9 am report

Every morning the 09:17 IST run sends one Telegram report, also on days when all is fine. GitHub sometimes
starts a scheduled run a little late. **If nothing has come by 10:00 IST, that is the alarm:** open
GitHub → Actions → collect and look at the last runs. GitHub also turns off scheduled runs in a public repo
after 60 days without a commit; the collect page then shows a banner with an Enable button.

It looks like this (your numbers will differ):

```
📊 HackRadar: daily report (26 Nov)

Runs (pichhle 24 ghante): 24, source runs 152 ok, 0 error
Open hackathons: 210
• unstop: 150 (71%)
• devfolio: 23 (11%)
• ...
Pichhle 24 ghante mein: 6 naye, 3 closed, 1 stale
Not-hackathons is run mein rok diye: 12
Push bheje (24 ghante): 9
Devices: 14, alerts on: 9
Queue: 1 submissions review ke liye, 0 report (24 ghante)

✅ Sab theek
```

- Runs should be about 24, one per hour.
- An event listed on two platforms counts for both, so the shares can add up to more than 100%.
- "Not-hackathons" counts only the 09:17 run, which doesn't fetch ETHGlobal and dev.events.
- On a day with problems, the last part is "⚠️ Dekhna hai:" with one line per problem, for example
  `• devfolio: 24 mein se 1 runs mein error`.

Other Telegram messages, all for you only (users never see Telegram; they get pushes in the app):
- ⚠️ a source gave no hackathons, or only errors, for 48 hours;
- 🚨 Data blow-up: the safety brake from step 3 kept events open;
- new submissions and wrong-info reports to review;
- 🚨 the whole run failed.

A problem alert comes once when the problem starts, then at most every 6 hours while it lasts.
