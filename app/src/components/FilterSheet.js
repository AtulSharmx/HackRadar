import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { applyView, clearedFilters, FEE_CHOICES, feeChoice } from '../lib/feedView';
import { DEGREES, THEMES } from '../lib/labels';
import { space, type, useAppTheme } from '../theme';
import Button from './Button';
import Chip from './Chip';
import { Group } from './OnboardingStep';
import Segmented from './Segmented';
import Sheet from './Sheet';
import SwitchRow from './SwitchRow';

const MODES = [['online', 'Online'], ['offline', 'Offline'], ['both', 'Both']];
const MODE_LISTS = { online: ['online'], offline: ['offline', 'hybrid'], both: ['online', 'offline', 'hybrid'] };
const FEES = [['free', 'Free'], ['paid', 'Paid'], ['both', 'Both']];
const DISTANCES = [[10, '10'], [25, '25'], [50, '50'], [100, '100'], [null, 'Any']];
const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

// Changes stay inside the sheet until "Show N hackathons"; the count updates live.
export default function FilterSheet({ visible, onClose, filters, onApply, onSaveAlert, onSetCity, events, query, sort, prefs }) {
  const { colors } = useAppTheme();
  const [f, setF] = useState(filters);
  useEffect(() => {
    if (visible) setF(filters);
  }, [visible, filters]);

  // counted only while open: closed, it would redo the whole feed on every sort change and search keystroke
  const count = useMemo(
    () => (visible ? applyView(events, { query, filters: f, sort, prefs }).length : 0),
    [visible, events, query, f, sort, prefs],
  );
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const hasLocation = prefs?.lat != null;
  const fee = feeChoice(f);
  const toggleTheme = (k) => set({ themes: f.themes.includes(k) ? f.themes.filter((t) => t !== k) : [...f.themes, k] });
  const modeKey = Object.keys(MODE_LISTS).find((k) => same(f.modes, MODE_LISTS[k])) || null;
  const degree = DEGREES.find((d) => d.key === prefs?.degree);
  const degreeLabel = degree ? (degree.key === 'other' ? 'college students' : degree.label) : null;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Filters"
      footer={
        <>
          <Button label="Save as my alert filter" variant="text" onPress={() => onSaveAlert(f)} />
          <View style={styles.footerRow}>
            {/* Clear = no filters at all (user's wording, 30 Sep); my defaults come back with the next app open */}
            <Button label="Clear" variant="secondary" onPress={() => setF(clearedFilters())} />
            <Button
              label={count === 1 ? 'Show 1 hackathon' : `Show ${count} hackathons`}
              onPress={() => onApply(f)}
              style={styles.show}
            />
          </View>
        </>
      }
    >
      <Group label="Mode">
        <Segmented options={MODES} value={modeKey} onChange={(k) => set({ modes: MODE_LISTS[k] })} accessibilityLabel="Mode" />
      </Group>
      <Group label="Fee" note={fee === 'free' ? "Also shows events that don't list a fee." : null}>
        <Segmented options={FEES} value={fee} onChange={(k) => set(FEE_CHOICES[k])} accessibilityLabel="Fee" />
      </Group>
      <Group label="Themes">
        {THEMES.map(([k, label]) => (
          <Chip key={k} label={label} selected={f.themes.includes(k)} showRemove={false} onPress={() => toggleTheme(k)} />
        ))}
      </Group>
      <Group label={hasLocation ? 'Distance for offline events (km)' : 'Distance for offline events'}>
        {hasLocation ? (
          <Segmented options={DISTANCES} value={f.max_km ?? null} onChange={(km) => set({ max_km: km })} accessibilityLabel="Distance for offline events" />
        ) : (
          <View style={styles.noCity}>
            <Text style={[type.body, { color: colors.textSecondary }]}>Set your city to filter by distance.</Text>
            <Button label="Set city" variant="text" onPress={onSetCity} />
          </View>
        )}
      </Group>
      <View>
        <SwitchRow label="Closing within 7 days" value={f.closing_within_days === 7} onChange={(v) => set({ closing_within_days: v ? 7 : null })} />
        {degreeLabel ? (
          <SwitchRow label={`Open to ${degreeLabel}`} value={f.eligible_only === true} onChange={(v) => set({ eligible_only: v })} />
        ) : null}
        <SwitchRow label="Solo allowed" value={!!f.solo_only} onChange={(v) => set({ solo_only: v })} />
        <SwitchRow label="Hide warnings" value={!!f.exclude_warnings} onChange={(v) => set({ exclude_warnings: v })} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  footerRow: { flexDirection: 'row', gap: space.sm },
  show: { flex: 1 },
  noCity: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: space.sm },
});
