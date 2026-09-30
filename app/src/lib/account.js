// Sign in / create account without passwords: Google, GitHub, a code by SMS (India, +91) or by email.
// A guest who signs in keeps their user id when the email/phone/Google account is new (it is attached to
// the guest), so saves and preferences simply stay. If it already belongs to an account, that account is
// signed in and this phone's saves are uploaded to it (lib/saved.js). docs/auth-plan.md
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from './supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
// Google Cloud "Web application" OAuth client id (public, not a secret): native Google sign-in asks Google
// for an ID token addressed to it, and Supabase's Google provider lists the same id
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export const RESEND_AFTER = 30; // seconds before "Resend code" works again
export const CODE_LENGTH = 6;

export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((s || '').trim());
export const phoneDigits = (s) => (s || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
export const isIndianMobile = (s) => /^[6-9]\d{9}$/.test(phoneDigits(s));
export const fullPhone = (s) => `+91${phoneDigits(s)}`;

// Which sign-in methods the server has switched on ({ google, github, phone, email }), so a method that
// isn't set up yet is shown as "soon" instead of failing. Public endpoint, no user data.
export async function getProviders() {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } });
    return (await res.json()).external || {};
  } catch {
    return {};
  }
}

async function currentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

const already = (error) => /already|registered|exists/i.test(`${error?.message} ${error?.code}`);
// the server can't attach a new sign-in to the guest (manual linking off, or already taken): sign in instead;
// the guest's saves still move over (lib/saved.js uploads them on an account change)
const cantLink = (error) => already(error) || /manual linking|linking is disabled/i.test(`${error?.message} ${error?.code}`);
// where an emailed link (instead of a code) or a browser sign-in comes back to: this app
const backToApp = () => Linking.createURL('auth-callback');

// true while a browser sign-in waits for its answer, so the auth-callback route doesn't also use the code
let browserSignIn = false;
export const browserSignInActive = () => browserSignIn;

// Email or SMS code. channel: 'email' | 'phone'. -> 'link' (confirms it on this guest) | 'signin'
export async function sendCode(channel, value) {
  const target = channel === 'phone' ? { phone: fullPhone(value) } : { email: value.trim().toLowerCase() };
  const emailRedirectTo = backToApp(); // if the email template sends a link, tapping it still signs in here
  if ((await currentUser())?.is_anonymous) {
    const { error } = await supabase.auth.updateUser(target, { emailRedirectTo });
    if (!error) return 'link';
    if (!already(error)) throw error;
  }
  const { error } = await supabase.auth.signInWithOtp({ ...target, options: { shouldCreateUser: true, emailRedirectTo } });
  if (error) throw error;
  return 'signin';
}

export async function verifyCode(channel, value, code, mode) {
  const phone = channel === 'phone';
  const { data, error } = await supabase.auth.verifyOtp({
    ...(phone ? { phone: fullPhone(value) } : { email: value.trim().toLowerCase() }),
    token: code.trim(),
    type: phone ? (mode === 'link' ? 'phone_change' : 'sms') : (mode === 'link' ? 'email_change' : 'email'),
  });
  if (error) throw error;
  return data.user;
}

// "hackradar://auth-callback?code=..." or "...#access_token=...": both the query and the fragment
export function paramsOf(url) {
  const out = {};
  const [beforeHash, hash] = (url || '').split('#');
  const query = beforeHash.split('?')[1];
  for (const part of [query, hash]) {
    for (const pair of (part || '').split('&')) {
      const [k, v = ''] = pair.split('=');
      if (k) out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
    }
  }
  return out;
}

async function browserRound(request, redirect) {
  const { data, error } = await request;
  if (error) throw error;
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirect);
  return result.type === 'success' ? paramsOf(result.url) : null; // null: the user closed the browser
}

// The phone's own Google account picker: only in a development/store build (Expo Go has no native module)
function nativeGoogle() {
  if (Constants.executionEnvironment === 'storeClient' || !GOOGLE_WEB_CLIENT_ID) return null;
  try {
    return require('@react-native-google-signin/google-signin'); // eslint-disable-line global-require
  } catch {
    return null;
  }
}

async function signInWithGoogleNative({ GoogleSignin, isSuccessResponse }) {
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  await GoogleSignin.signOut().catch(() => {}); // always show the picker, never reuse the last account silently
  const res = await GoogleSignin.signIn();
  if (!isSuccessResponse(res)) return null; // picker closed
  const token = res.data.idToken;
  if ((await currentUser())?.is_anonymous) {
    const { data, error } = await supabase.auth.linkIdentity({ provider: 'google', token });
    if (!error) return data.user;
    if (!cantLink(error)) throw error;
  }
  const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'google', token });
  if (error) throw error;
  return data.user;
}

// Google (native picker when the build has it) or GitHub/Google in the browser, back with a one-time code.
// Resolves with the signed-in user, or null when the user closed the picker or browser.
export async function signInWithProvider(provider) {
  const native = provider === 'google' ? nativeGoogle() : null;
  if (native) {
    try {
      return await signInWithGoogleNative(native);
    } catch (e) {
      const { statusCodes } = native;
      if (e?.code === statusCodes?.SIGN_IN_CANCELLED || e?.code === statusCodes?.IN_PROGRESS) return null;
      // anything else (e.g. DEVELOPER_ERROR: the Android OAuth client/SHA-1 isn't set up yet): the browser still works
    }
  }
  browserSignIn = true;
  try {
    return await signInInBrowser(provider);
  } finally {
    browserSignIn = false;
  }
}

async function signInInBrowser(provider) {
  const redirectTo = backToApp();
  const options = { redirectTo, skipBrowserRedirect: true };
  let p;
  if ((await currentUser())?.is_anonymous) {
    const link = await supabase.auth.linkIdentity({ provider, options });
    if (link.error && !cantLink(link.error)) throw link.error;
    if (!link.error) {
      const result = await WebBrowser.openAuthSessionAsync(link.data.url, redirectTo);
      if (result.type !== 'success') return null; // closed the browser
      p = paramsOf(result.url);
      // that Google/GitHub account already has a HackRadar account: sign in to it instead
      if (cantLink({ message: p.error_description, code: p.error_code })) p = null;
    }
  }
  if (!p) p = await browserRound(supabase.auth.signInWithOAuth({ provider, options }), redirectTo);
  if (!p) return null;
  if (p.error) throw new Error(p.error_description || p.error);
  if (p.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(p.code);
    if (error) throw error;
    return data.user;
  }
  if (p.access_token) {
    const { data, error } = await supabase.auth.setSession({ access_token: p.access_token, refresh_token: p.refresh_token });
    if (error) throw error;
    return data.user;
  }
  throw new Error('The sign-in answer had no session');
}

// hackradar://auth-callback?code=... opened from an emailed link (or a browser sign-in finishing late)
export async function finishFromLink(params) {
  if (params.error_description || params.error) throw new Error(params.error_description || params.error);
  if (!params.code) return null;
  const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
  if (error) throw error;
  return data.user;
}

// A new phone signing in before onboarding: the account's own feed setup, if it has one
export async function savedPrefsOf(user) {
  const { data } = await supabase.from('devices').select('prefs,city,state,lat_rounded,lng_rounded,alerts_enabled').eq('id', user.id).maybeSingle();
  if (!data?.prefs?.themes?.length) return null;
  return {
    ...data.prefs,
    city: data.city,
    state: data.state,
    lat: data.lat_rounded,
    lng: data.lng_rounded,
    notifications: !!data.alerts_enabled,
  };
}

// Plain words for the errors people actually hit
export function explain(error, what = 'That') {
  const m = `${error?.message || ''} ${error?.code || ''}`.toLowerCase();
  if (m.includes('manual linking')) return `${what} sign-in needs one more server setting (manual linking). Use email for now.`;
  if (m.includes('provider') && (m.includes('not enabled') || m.includes('disabled') || m.includes('unsupported'))) {
    return `${what} sign-in isn't switched on yet. Use another way for now.`;
  }
  if (m.includes('rate') || m.includes('too many') || m.includes('seconds')) return 'Too many codes asked for. Wait a minute and try again.';
  if (m.includes('access_denied') || m.includes('access denied')) return `${what} didn't allow the sign-in. Try again, or use email.`;
  if (!m.includes('client') && (m.includes('expired') || m.includes('otp') || m.includes('token'))) {
    return "That code didn't work. Check it, or send a new one.";
  }
  if (m.includes('network') || m.includes('fetch')) return "Can't reach HackRadar. Check your connection.";
  return "Couldn't do that right now. Try again in a minute.";
}

// The server's own words, shown small under the plain message so a failure can be traced
export function detailOf(error) {
  const d = `${error?.message || error || ''}`.trim();
  return d ? d.slice(0, 160) : null;
}

export async function logOut() {
  const { error } = await supabase.auth.signOut({ scope: 'local' }); // this phone only; other phones stay signed in
  if (error) throw error;
}
