import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useToast } from '../components/Toast';
import { browserSignInActive, explain, finishFromLink } from '../lib/account';
import { success } from '../lib/haptics';
import { useAppTheme } from '../theme';

// hackradar://auth-callback lands here in two cases:
// - Google/GitHub in the browser: the sign-in screen already has the answer, so just step back;
// - a sign-in link from an email (when the email template sends a link, not a code): finish it here.
export default function AuthCallback() {
  const { colors } = useAppTheme();
  const toast = useToast();
  const params = useLocalSearchParams();

  useEffect(() => {
    let live = true;
    const leave = () => {
      if (!live) return;
      if (router.canGoBack()) router.back();
      else router.replace('/');
    };
    if (browserSignInActive() || (!params.code && !params.error)) {
      leave();
      return undefined;
    }
    finishFromLink(params)
      .then((user) => {
        if (user) {
          success();
          toast(`Signed in as ${user.email || 'your account'}.`);
        }
      })
      .catch((e) => toast(explain(e, 'That link')))
      .finally(leave);
    return () => {
      live = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.brand} />
    </View>
  );
}
