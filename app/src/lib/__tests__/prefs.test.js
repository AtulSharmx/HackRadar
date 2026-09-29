jest.mock('../supabase', () => ({ supabase: {} }));

import { DEFAULT_PREFS, round2, toDeviceRow } from '../prefs';

test('device row: rounded location, alert filter mirrors answers, alerts follow permission', () => {
  const row = toDeviceRow({
    ...DEFAULT_PREFS, themes: ['ai_ml'], fee_max: 500, city: 'Gurugram', state: 'Haryana',
    lat: 28.459812, lng: 77.026634, notifications: true, hide_warnings: true,
  });
  expect(row.lat_rounded).toBe(28.46);
  expect(row.lng_rounded).toBe(77.03);
  expect(row.alerts_enabled).toBe(true);
  expect(row.alert_filter).toEqual({
    themes: ['ai_ml'], modes: ['online', 'offline', 'hybrid'], fee_max: 500, max_km: 50,
    closing_within_days: null, solo_only: false, exclude_warnings: true,
  });
  expect(row.prefs).not.toHaveProperty('lat');   // raw location never goes into prefs
  expect(row.prefs).not.toHaveProperty('telegram');
});

test('no location stays null', () => {
  expect(toDeviceRow(DEFAULT_PREFS).lat_rounded).toBeNull();
  expect(round2(null)).toBeNull();
});
