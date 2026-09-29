# Login plan (decided 2026-09-29)

Built in Stage 5 (step 24 onward), UI made with the ui-ux-pro-max skill.

## Decision: guest first, account when it pays off

1. **Open the app → feed right away.** No login wall. Supabase anonymous sign-in runs silently in the background, so the user already has a real user id.
2. **Ask for an account only at the moment it helps the user:**
   - first time they tap Save ("Keep your saved hackathons safe, even if you change phone"),
   - turning on alerts,
   - Settings → "Sign in / Back up".
   One screen, can be skipped with "Not now". Never asked again for 7 days after a skip.
3. **Sign-in options (only two):**
   - **Continue with Google**: main button. One tap, and nearly every Indian student has a Gmail account. Native Android sign-in (`@react-native-google-signin/google-signin` → `supabase.auth.signInWithIdToken`), needs a dev build.
   - **Email code**: a 6-digit code sent by email, no password. For people without Google on the phone.
4. **Upgrading a guest keeps their data.** Linking Google or email to the anonymous user (`linkIdentity` / `updateUser`) keeps the same user id, so saved events and prefs carry over without copying.
5. **Already has an account (new phone):** linking fails because the identity exists. Then sign in to that account and move the guest's saves and prefs into it with one small database function, keeping the account's values when both have one.

## Deliberately not doing

- **Passwords.** Forgotten passwords, reset emails and leaks, and nothing gained for this app.
- **Phone OTP.** SMS costs money per message in India and needs a paid provider.
- **Login before seeing anything.** Forced sign-up before any value is a top reason new users drop off.

## Things that must be set up for real users (not optional)

- Supabase Auth: turn on **manual identity linking** and the **Google provider** (Google Cloud OAuth client ids for Android + web).
- **Custom SMTP** for email codes (Resend or Brevo free tier). Supabase's built-in email sender is rate-limited to a few emails per hour and is meant only for testing.
- **Delete account** in Settings (step 31): deletes the auth user, and every linked row goes with it through the cascades. Play Store requires this for apps with accounts.

## Schema change needed at step 34 (push), not step 24

Today `devices.id = auth user id`, so one user = one device. With login, one person can have several phones. The change:

- `devices` → per user: prefs, alert filter, quiet hours, city.
- new `push_tokens(user_id, expo_push_token unique, platform, updated_at)`: one row per phone.
- `saved_events` keyed by user_id.

Step 24 needed no change: devices.id is already the user id, so saves and prefs follow the user once login links an identity. Only push tokens need one row per phone, so this goes in with push (step 34), as a new migration file with the same RLS rule (own rows only), and the RLS check script gets extended to cover it.

## Sources
- Supabase anonymous sign-ins and converting to a permanent user: https://supabase.com/docs/guides/auth/auth-anonymous
- Supabase identity linking: https://supabase.com/docs/guides/auth/auth-identity-linking
- Native Google sign-in for Expo + Supabase: https://github.com/supabase/supabase/pull/40017
- Login wall vs guest mode: https://gtstu.com/app-login-required-or-guest-mode/
