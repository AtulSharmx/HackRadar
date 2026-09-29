import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { applyView } from '../lib/feedView';
import { THEMES } from '../lib/labels';
import { layout, space, type, useAppTheme } from '../theme';
import Button from './Button';
import Chip from './Chip';
import { Group } from './OnboardingStep';
import Sheet from './Sheet';

const MODES = [['Online', ['online']], ['Offline', ['offline', 'hybrid']], ['Both', ['online', 'offline', 'hybrid']]];
const FEES = [['Free only', 0], ['Free and paid', null]];
const DISTANCES = [[10, '10 km'], [25, '25 km'], [50, '50 km'], [100, '100 km'], [null, 'Anywhere']];
const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

function SwitchRow({ label, value, onChange, colors }) {
  return (
    <View style={styles.switchRow}>
      <Text style={[type.body, styles.switchLabel, { color: colors.textPrimary }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.brand, false: colors.border }}
        thumbColor={colors.surface}
        accessibilityLabel={label}
      />
    </View>
  );
}

// Changes stay inside the sheet until "Show N hackathons"; the count updates live.
export default function FilterSheet({ visible, onClose, filters, defaults, onApply, onSaveAlert, events, query, sort, prefs }) {
  const { colors } = useAppTheme();
  const [f, setF] = useState(filters);
  useEffect(() => {
    if (visible) setF(filters);
  }, [visible, filters]);

  const count = useMemo(() => applyView(events, { query, filters: f, sort, prefs }).length, [events, query, f, sort, prefs]);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const hasLocation = prefs?.lat != null;
  const toggleTheme = (k) => set({ themes: f.themes.includes(k) ? f.themes.filter((t) => t !== k) : [...f.themes, k] });
  const radio = (selected, label, onPress) => (
    <Chip key={label} label={label} selected={selected} showRemove={false} role="radio" onPress={onPress} />
  );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Filters"
      footer={
        <>
          <Button label="Save as my alert filter" variant="text" onPress={() => onSaveAlert(f)} />
          <View style={styles.footerRow}>
            <Button label="Reset" variant="secondary" onPress={() => setF(defaults)} />
            <Button
              label={count === 1 ? 'Show 1 hackathon' : `Show ${count} hackathons`}
              onPress={() => onApply(f)}
              style={styles.show}
            />
          </View>
        </>
      }
    >
      <Group label="Mode">{MODES.map(([label, modes]) => radio(same(f.modes, modes), label, () => set({ modes })))}</Group>
      <Group label="Fee">{FEES.map(([label, fee]) => radio(f.fee_max === fee, label, () => set({ fee_max: fee })))}</Group>
      <Group label="Themes">
        {THEMES.map(([k, label]) => (
          <Chip key={k} label={label} selected={f.themes.includes(k)} showRemove={false} onPress={() => toggleTheme(k)} />
        ))}
      </Group>
      <Group label="Distance for offline events">
        {hasLocation ? (
          DISTANCES.map(([km, label]) => radio(f.max_km === km, label, () => set({ max_km: km })))
        ) : (
          <Text style={[type.body, { color: colors.textSecondary }]}>Set your city in Settings to filter by distance.</Text>
        )}
      </Group>
      <View>
        <SwitchRow label="Closing within 7 days" value={f.closing_within_days === 7} onChange={(v) => set({ closing_within_days: v ? 7 : null })} colors={colors} />
        <SwitchRow label="Solo allowed" value={!!f.solo_only} onChange={(v) => set({ solo_only: v })} colors={colors} />
        <SwitchRow label="Hide warnings" value={!!f.exclude_warnings} onChange={(v) => set({ exclude_warnings: v })} colors={colors} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', minHeight: layout.minTouch, gap: space.md },
  switchLabel: { flex: 1 },
  footerRow: { flexDirection: 'row', gap: space.sm },
  show: { flex: 1 },
});
