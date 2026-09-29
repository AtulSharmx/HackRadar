import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SORTS } from '../lib/feedView';
import { layout, space, type, useAppTheme } from '../theme';
import Sheet from './Sheet';

// Pick one sort. "Nearest" is disabled with a note when no city is set (App Flow).
export default function SortSheet({ visible, onClose, sort, onPick, hasLocation }) {
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
              style={[styles.row, { borderBottomColor: colors.border }]}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, disabled }}
              accessibilityLabel={label}
            >
              <MaterialCommunityIcons
                name={on ? 'radiobox-marked' : 'radiobox-blank'}
                size={24}
                color={disabled ? colors.border : on ? colors.brand : colors.textSecondary}
              />
              <View style={styles.text}>
                <Text style={[type.body, { color: disabled ? colors.textSecondary : colors.textPrimary }]}>{label}</Text>
                {disabled ? (
                  <Text style={[type.meta, { color: colors.textSecondary }]}>Set your city to sort by distance</Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
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
});
