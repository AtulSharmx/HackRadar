-- 0005_alerts_off_by_default.sql
-- A fresh app install must not get alerts before the user allows notifications
-- (App Flow: onboarding step 5). Onboarding sets alerts_enabled = true when allowed.
alter table public.devices alter column alerts_enabled set default false;
