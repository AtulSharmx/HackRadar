// Sign in / create account with a 6-digit email code (no password), and log out. docs/auth-plan.md.
// New email: it is attached to the current guest (same user id), so saves and preferences simply stay.
// Email that already has an account: sign in to it; the phone's saves are then uploaded to it (lib/saved.js).
import { supabase } from './supabase';

export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((s || '').trim());

// -> 'link' (code confirms the email on this guest) or 'signin' (code signs in to an existing account)
export async function sendCode(email) {
  const address = email.trim().toLowerCase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.is_anonymous) {
    const { error } = await supabase.auth.updateUser({ email: address });
    if (!error) return 'link';
    if (!/already|registered|exists/i.test(error.message || '')) throw error;
  }
  const { error } = await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: true } });
  if (error) throw error;
  return 'signin';
}

export async function verifyCode(email, code, mode) {
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: mode === 'link' ? 'email_change' : 'email',
  });
  if (error) throw error;
  return data.user;
}

// Plain words for the errors people actually hit
export function explain(error) {
  const m = `${error?.message || ''} ${error?.code || ''}`.toLowerCase();
  if (m.includes('rate') || m.includes('too many') || m.includes('seconds')) return 'Too many codes asked for. Wait a minute and try again.';
  if (m.includes('expired') || m.includes('invalid') || m.includes('otp')) return "That code didn't work. Check it, or send a new one.";
  if (m.includes('network') || m.includes('fetch')) return "Can't reach HackRadar. Check your connection.";
  return "Couldn't do that right now. Try again in a minute.";
}

export async function logOut() {
  const { error } = await supabase.auth.signOut({ scope: 'local' }); // this phone only; other phones stay signed in
  if (error) throw error;
}
