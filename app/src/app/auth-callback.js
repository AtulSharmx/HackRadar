import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { useAppTheme } from '../theme';

// Google/GitHub send the browser back to hackradar://auth-callback. The sign-in screen already has the
// answer from its browser session (lib/account.signInWithProvider); this route only keeps that deep link
// from landing on "page not found", and steps straight back.
export default function AuthCallback() {
  const { colors } = useAppTheme();
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);
  return <View style={{ flex: 1, backgroundColor: colors.background }} />;
}
