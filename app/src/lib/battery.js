import { Linking, Platform } from 'react-native';

// Battery savers on Xiaomi, Realme, Oppo, Vivo, Samsung and OnePlus phones often hold back alarms and
// pushes, so reminders arrive late or not at all. The tip shows once after onboarding (when alerts or
// reminders are on) and stays in Profile. It only opens settings: HackRadar never asks for the
// "ignore battery optimisations" permission (Google Play restricts it).
const SEEN_KEY = 'hackradar.batteryTip.v1';

const STEPS = [
  [/xiaomi|redmi|poco/i, 'Open App info > Battery saver and pick "No restrictions". Also turn on Autostart.'],
  [/realme|oppo/i, 'Open App info > Battery usage and allow background activity.'],
  [/vivo|iqoo/i, 'Open Settings > Battery > Background power consumption and allow HackRadar.'],
  [/samsung/i, 'Open App info > Battery and pick "Unrestricted".'],
  [/oneplus/i, 'Open App info > Battery and pick "Don\'t optimise".'],
];

export function batterySteps(maker = Platform.constants?.Manufacturer || Platform.constants?.Brand || '') {
  return (STEPS.find(([re]) => re.test(maker)) || [null, 'Open App info > Battery and pick "Unrestricted" or "Don\'t optimise".'])[1];
}

export function batteryTipSeen() {
  try {
    return globalThis.localStorage?.getItem(SEEN_KEY) === '1';
  } catch {
    return true; // can't remember it: better not to show it every time
  }
}

export function markBatteryTipSeen() {
  try {
    globalThis.localStorage?.setItem(SEEN_KEY, '1');
  } catch {
    // shown again next time, harmless
  }
}

// The phone's battery-optimisation list, else this app's info page, else the app's settings
export async function openBatterySettings() {
  if (Platform.OS !== 'android') return;
  let IntentLauncher;
  try {
    IntentLauncher = require('expo-intent-launcher'); // eslint-disable-line global-require
  } catch {
    return Linking.openSettings();
  }
  try {
    await IntentLauncher.startActivityAsync('android.settings.APPLICATION_DETAILS_SETTINGS', { data: 'package:com.hackradar.app' });
  } catch {
    try {
      await IntentLauncher.startActivityAsync('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
    } catch {
      await Linking.openSettings();
    }
  }
}
