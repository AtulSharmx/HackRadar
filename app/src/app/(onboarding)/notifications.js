import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import OnboardingStep from '../../components/OnboardingStep';
import { useDraft } from '../../lib/draft';
import { askNotificationPermission } from '../../lib/notificationPermission';
import { usePrefs } from '../../lib/prefs';
import { space, type, useAppTheme } from '../../theme';

const WHAT = [
  ['radar', 'New hackathons that match you'],
  ['clock-outline', 'Reminders 7 days, 48 h and 24 h before a saved deadline'],
  ['calendar-alert', 'A heads-up when a saved event changes its date or venue'],
];

// Step 5. The Android permission prompt appears only after tapping Allow.
export default function NotificationsStep() {
  const { colors } = useAppTheme();
  const { draft } = useDraft();
  const { save } = usePrefs();

  // No city: the Feed shows online events until one is set (feedView.defaultFilters), and the mode picked
  // in step 3 is kept for when it is
  const finish = (notifications) => {
    save({ ...draft, notifications });
    router.replace('/');
  };

  const allow = async () => finish(await askNotificationPermission());

  return (
    <OnboardingStep
      step={5}
      title="Get told before you miss one"
      next={{ label: 'Allow notifications', onPress: allow }}
      skip={() => finish(false)}
    >
      <View style={styles.list}>
        {WHAT.map(([icon, text]) => (
          <View key={text} style={styles.item}>
            <MaterialCommunityIcons name={icon} size={24} color={colors.brand} />
            <Text style={[type.body, styles.itemText, { color: colors.textPrimary }]}>{text}</Text>
          </View>
        ))}
      </View>
      <Text style={[type.meta, { color: colors.textSecondary }]}>
        You can turn these off any time in Profile.
      </Text>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.lg },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  itemText: { flex: 1 },
});
