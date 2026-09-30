import { StyleSheet, Switch, Text, View } from 'react-native';

import { select } from '../lib/haptics';
import { layout, space, type, useAppTheme } from '../theme';

// Label + switch, the whole row 48 dp. The thumb gets its own colour: the surface colour alone
// vanished on the dark track when off.
export default function SwitchRow({ label, hint, value, onChange }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={[type.body, { color: colors.textPrimary }]}>{label}</Text>
        {hint ? <Text style={[type.meta, { color: colors.textSecondary }]}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => {
          select();
          onChange(v);
        }}
        trackColor={{ true: colors.brand, false: colors.border }}
        thumbColor={value ? colors.surface : colors.textSecondary}
        accessibilityLabel={label}
        accessibilityHint={hint}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: layout.minTouch, gap: space.md },
  text: { flex: 1, paddingVertical: space.xs },
});
