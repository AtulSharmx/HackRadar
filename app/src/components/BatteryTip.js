import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, Text, View } from 'react-native';

import { batterySteps, markBatteryTipSeen, openBatterySettings } from '../lib/battery';
import { space, type, useAppTheme } from '../theme';
import Button from './Button';
import Sheet from './Sheet';

// "Make sure reminders arrive": once after onboarding (Feed) and from Profile any time
export default function BatteryTip({ visible, onClose }) {
  const { colors } = useAppTheme();
  const close = () => {
    markBatteryTipSeen();
    onClose();
  };
  return (
    <Sheet
      visible={visible}
      onClose={close}
      title="Make sure reminders arrive"
      footer={(
        <>
          <Button
            label="Open battery settings"
            onPress={() => {
              close();
              openBatterySettings().catch(() => {});
            }}
          />
          <Button label="Not now" variant="text" onPress={close} />
        </>
      )}
    >
      <View style={styles.body}>
        <MaterialCommunityIcons name="battery-heart-variant" size={32} color={colors.brand} />
        <Text style={[type.body, { color: colors.textPrimary }]}>
          Battery saver on many phones holds back reminders and alerts, so they arrive late or not at all.
        </Text>
        <Text style={[type.body, { color: colors.textPrimary }]}>{batterySteps()}</Text>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md },
});
