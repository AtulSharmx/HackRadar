import { Linking, PermissionsAndroid, Platform } from 'react-native';

// Android's notification permission, asked with React Native's own API (the same permission
// expo-notifications would ask for, and it works even where that module isn't loaded).
export async function askNotificationPermission() {
  if (Platform.OS !== 'android') return false; // v1 is Android only
  if (Platform.Version < 33) return true; // before Android 13 notifications need no runtime permission
  try {
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

// The Notifications switch, from Settings or a toast's "Turn on": Android asks first; a refusal
// points to the system settings, where only the person can allow it again.
export async function turnOnNotifications(update, toast) {
  const granted = await askNotificationPermission();
  update({ notifications: granted });
  if (!granted) {
    toast('Notifications are blocked for HackRadar.', { action: { label: 'Open settings', onPress: () => Linking.openSettings() } });
  }
  return granted;
}
