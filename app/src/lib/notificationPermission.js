import { PermissionsAndroid, Platform } from 'react-native';

// Android's notification permission, asked with React Native's own API.
// expo-notifications can't even be imported in Expo Go on Android (removed in SDK 53), so it waits
// for the development build; the permission itself is the same one either way.
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
