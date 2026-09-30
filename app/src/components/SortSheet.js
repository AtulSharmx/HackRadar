import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SORTS } from '../lib/feedView';
import { layout, space, type, useAppTheme } from '../theme';
import Button from './Button';
import Sheet from './Sheet';

// What each order is based on, so the order is never a mystery
const HINTS = {
  best: 'Your interests, distance, fee, deadline and trust',
  closing: 'Registration deadline, soonest first',
  newest: 'When it was posted on the source',
  nearest: 'Offline and hybrid first, by distance from you',
  prize: 'Cash prize, biggest first',
};

// Pick one sort. "Nearest" is disabled with a way to set a city when none is set (App Flow).
export default function SortSheet({ visible, onClose, sort, onPick, hasLocation, onSetCity }) {
  const { colors } = useAppTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title="Sort by">
      <View>
        {SORTS.map(([key, label]) => {
          const disabled = key === 'nearest' && !hasLocation;
          const on = sort === key;
          return (
            <Pressable
              key={key}
              disabled={disabled}
              onPress={() => onPick(key)}
              android_ripple={{ color: colors.border }}
              style={[styles.row, { borderBottomColor: colors.border }]}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, disabled }}
              accessibilityLabel={label}
              accessibilityHint={HINTS[key]}
            >
              <MaterialCommunityIcons
                name={on ? 'radiobox-marked' : 'radiobox-blank'}
                size={24}
                color={disabled ? colors.border : on ? colors.brand : colors.textSecondary}
              />
              <View style={styles.text}>
                <Text style={[type.body, { color: disabled ? colors.textSecondary : colors.textPrimary }]}>{label}</Text>
                <Text style={[type.meta, { color: colors.textSecondary }]}>
                  {disabled ? 'Set your city to sort by distance' : HINTS[key]}
                </Text>
              </View>
            </Pressable>
          );
        })}
        {!hasLocation && onSetCity ? <Button label="Set your city" variant="text" onPress={onSetCity} style={styles.setCity} /> : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    minHeight: layout.minTouch + space.sm, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, paddingVertical: space.sm },
  setCity: { alignSelf: 'flex-start', marginTop: space.sm },
});
