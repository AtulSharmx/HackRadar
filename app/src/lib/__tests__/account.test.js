jest.mock('../supabase', () => ({ supabase: {} }));
jest.mock('expo-linking', () => ({ createURL: () => 'hackradar://auth-callback', addEventListener: () => ({ remove() {} }) }));
jest.mock('expo-web-browser', () => ({}));

import { explain, fullPhone, isEmail, isIndianMobile, paramsOf } from '../account';

test('the OAuth answer is read from the query or the fragment', () => {
  expect(paramsOf('hackradar://auth-callback?code=abc123')).toEqual({ code: 'abc123' });
  expect(paramsOf('exp://192.168.1.5:8081/--/auth-callback#access_token=t%2B1&refresh_token=r')).toEqual({ access_token: 't+1', refresh_token: 'r' });
  expect(paramsOf('hackradar://auth-callback?error=access_denied&error_description=Identity+is+already+linked')).toEqual({
    error: 'access_denied', error_description: 'Identity is already linked',
  });
});

test('Indian mobile numbers, typed any common way', () => {
  expect(isIndianMobile('98765 43210')).toBe(true);
  expect(isIndianMobile('+91 98765 43210')).toBe(true);
  expect(fullPhone('+91 98765 43210')).toBe('+919876543210');
  expect(isIndianMobile('12345 67890')).toBe(false); // Indian mobiles start with 6-9
  expect(isIndianMobile('98765')).toBe(false);
  expect(isEmail(' a.b@college.edu ')).toBe(true);
  expect(isEmail('a@b')).toBe(false);
});

test('errors in plain words', () => {
  expect(explain({ message: 'Unsupported provider: provider is not enabled' }, 'Google')).toBe("Google sign-in isn't switched on yet. Use another way for now.");
  expect(explain({ message: 'Token has expired or is invalid' })).toBe("That code didn't work. Check it, or send a new one.");
  expect(explain({ message: 'For security purposes, you can only request this after 27 seconds.' })).toMatch(/Wait a minute/);
});

test('manual linking off reads as a setting, not a broken app', () => {
  expect(explain({ message: 'Manual linking is disabled' }, 'Google')).toMatch(/one more server setting/);
});
