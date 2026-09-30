// Apply: open the registration page in the platform's own app when the phone has it, else say so.
// Only platforms whose Android app is confirmed to handle their own web links are listed:
// unstop.com/.well-known/assetlinks.json names com.dare2compete.app (checked 30 Sep 2026).
// Devfolio and Hack2Skill have no Android app; their pages open in the in-app browser as before.
import { Linking, Platform } from 'react-native';

export const APPS = {
  'unstop.com': { name: 'Unstop', package: 'com.dare2compete.app' },
};

// "https://unstop.com/hackathons/x" -> the app entry for its site, or null
export function appFor(url) {
  const m = /^https:\/\/(?:www\.)?([^/?#:]+)/i.exec(url || '');
  return (m && APPS[m[1].toLowerCase()]) || null;
}

export const playStoreUrl = (pkg) => `https://play.google.com/store/apps/details?id=${pkg}`;

// Android only. Resolves when the user comes back from the app ('opened'), or 'missing' when it isn't
// installed. The registration link goes straight to that app, not to its home screen.
export async function openInApp(url, app) {
  if (Platform.OS !== 'android') return 'missing';
  let IntentLauncher;
  try {
    IntentLauncher = require('expo-intent-launcher'); // eslint-disable-line global-require
  } catch {
    return 'missing';
  }
  try {
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', { data: url, packageName: app.package });
    return 'opened';
  } catch {
    return 'missing'; // ActivityNotFoundException: the app isn't on this phone
  }
}

// Play Store app first, the store's web page if that can't open
export async function openStore(app) {
  try {
    await Linking.openURL(`market://details?id=${app.package}`);
  } catch {
    await Linking.openURL(playStoreUrl(app.package));
  }
}
