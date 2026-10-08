jest.mock('../supabase', () => ({ supabase: {} }));
jest.mock('expo-linking', () => ({ createURL: () => 'hackradar://auth-callback', addEventListener: () => ({ remove() {} }) }));
jest.mock('expo-web-browser', () => ({}));

import { explain, isEmail, paramsOf, waitSeconds } from '../account';

test('the OAuth answer is read from the query or the fragment', () => {
  expect(paramsOf('hackradar://auth-callback?code=abc123')).toEqual({ code: 'abc123' });
  expect(paramsOf('exp://192.168.1.5:8081/--/auth-callback#access_token=t%2B1&refresh_token=r')).toEqual({ access_token: 't+1', refresh_token: 'r' });
  expect(paramsOf('hackradar://auth-callback?error=access_denied&error_description=Identity+is+already+linked')).toEqual({
    error: 'access_denied', error_description: 'Identity is already linked',
  });
});

test('email addresses', () => {
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

test('the server gap between two codes is read so the screen can count it down', () => {
  expect(waitSeconds({ message: 'For security purposes, you can only request this after 42 seconds.' })).toBe(42);
  expect(waitSeconds({ message: 'Invalid phone number' })).toBe(null);
  expect(waitSeconds(null)).toBe(null);
});
