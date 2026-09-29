import { StyleSheet, Text, View } from 'react-native';

import Button from '../../components/Button';
import { useSession } from '../../lib/session';
import { layout, space, type, useAppTheme } from '../../theme';

// Step 24: only the account status for now. The full Settings screen is step 31.
export default function SettingsScreen() {
  const { colors } = useAppTheme();
  const { user, error, retry } = useSession();

  let status;
  if (user) status = `Connected as a guest. Your id starts with ${user.id.slice(0, 8)}.`;
  else if (error) status = "Can't reach HackRadar. Check your connection.";
  else status = 'Connecting…';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Text style={[type.meta, { color: colors.textSecondary }]}>ACCOUNT</Text>
      <Text style={[type.body, styles.status, { color: colors.textPrimary }]}>{status}</Text>
      {error && !user ? <Button label="Retry" variant="secondary" onPress={retry} style={styles.retry} /> : null}
      <Text style={[type.meta, styles.later, { color: colors.textSecondary }]}>
        Preferences, location and notifications arrive in step 31.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: layout.screenPadding },
  status: { marginTop: space.sm },
  retry: { marginTop: space.md, alignSelf: 'flex-start' },
  later: { marginTop: space.xl },
});
