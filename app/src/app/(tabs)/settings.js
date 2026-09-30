import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Constants from 'expo-constants';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Button from '../../components/Button';
import Chip from '../../components/Chip';
import CitySearch from '../../components/CitySearch';
import { Group } from '../../components/OnboardingStep';
import Sheet from '../../components/Sheet';
import SwitchRow from '../../components/SwitchRow';
import { useToast } from '../../components/Toast';
import { DEGREES, THEME_NAMES, THEMES, yearOptions } from '../../lib/labels';
import { askNotificationPermission } from '../../lib/notificationPermission';
import { usePrefs } from '../../lib/prefs';
import { select } from '../../lib/haptics';
import { useSession } from '../../lib/session';
import { CHROME_MAX_SCALE, layout, radius, space, THEME_CHOICES, type, useAppTheme, useThemeChoice } from '../../theme';

// Same choices as onboarding
const MODES = [['Online', ['online']], ['Offline', ['offline', 'hybrid']], ['Both', ['online', 'offline', 'hybrid']]];
const FEES = [['Free only', 0], ['Free and paid', null]];
const DISTANCES = [[10, '10 km'], [25, '25 km'], [50, '50 km'], [100, '100 km'], [null, 'Anywhere']];
const SOURCES = 'Unstop, Devfolio, Hack2Skill'; // collector/adapters, SOURCES in .github/workflows/collect.yml
const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

function Section({ title, children, colors }) {
  return (
    <View style={styles.section}>
      <Text style={[type.meta, styles.sectionTitle, { color: colors.textSecondary }]} accessibilityRole="header">
        {title}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>{children}</View>
    </View>
  );
}

// Brief: label left, current value right in secondary text, chevron when it opens something
function Row({ label, value, onPress, colors, last }) {
  const body = (
    <>
      <Text style={[type.body, styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
      <Text style={[type.body, styles.rowValue, { color: colors.textSecondary }]} numberOfLines={onPress ? 1 : 2}>{value}</Text>
      {onPress ? <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} /> : null}
    </>
  );
  const style = [styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }];
  return onPress ? (
    <Pressable
      onPress={() => {
        select();
        onPress();
      }}
      style={style}
      android_ripple={{ color: colors.border }}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}
    >
      {body}
    </Pressable>
  ) : (
    <View style={style} accessible accessibilityLabel={`${label}, ${value}`}>{body}</View>
  );
}

const SHEET_TITLES = {
  themes: 'Interests', mode: 'Mode', fee: 'Fee', study: 'Degree and year', distance: 'How far can you travel?', look: 'Appearance',
};

// App Flow "Settings flows": one scrolling list; every change saves at once (phone first, then the devices row).
export default function SettingsScreen() {
  const { colors } = useAppTheme();
  const { prefs, save } = usePrefs();
  const { user, error, retry } = useSession();
  const toast = useToast();
  const params = useLocalSearchParams();
  const [open, setOpen] = useState(null); // key of SHEET_TITLES
  const [lastThemeNote, setLastThemeNote] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const { choice: look, setChoice: setLook } = useThemeChoice();

  // Feed's "Set city" opens the city picker straight away (a new "at" each time it's tapped)
  useEffect(() => {
    if (params.open === 'city') setCityOpen(true);
  }, [params.open, params.at]);

  if (!prefs) return null; // onboarding not finished: this tab isn't reachable then
  const update = (patch) => save({ ...prefs, ...patch });
  const close = () => {
    setOpen(null);
    setLastThemeNote(false);
  };

  const themes = prefs.themes || [];
  const toggleTheme = (k) => {
    if (themes.includes(k) && themes.length === 1) return setLastThemeNote(true); // at least one, as in onboarding
    setLastThemeNote(false);
    update({ themes: themes.includes(k) ? themes.filter((t) => t !== k) : [...themes, k] });
  };
  const modeLabel = MODES.find(([, m]) => same(prefs.modes || [], m))?.[0] || 'Both';
  const degree = DEGREES.find((d) => d.key === prefs.degree);
  const studyLabel = degree ? [degree.label, prefs.year ? `Year ${prefs.year}` : null].filter(Boolean).join(', ') : 'Not set';
  const pickDegree = (key) => {
    const next = prefs.degree === key ? null : key;
    const stillValid = yearOptions(next).some(([y]) => y === prefs.year); // Year 4 doesn't exist for MCA
    update({ degree: next, year: stillValid ? prefs.year : null });
  };
  const place = prefs.city ? [prefs.city, prefs.state].filter(Boolean).join(', ') : 'Not set';

  const setNotifications = async (on) => {
    if (!on) return update({ notifications: false });
    const granted = await askNotificationPermission();
    update({ notifications: granted });
    if (!granted) {
      toast('Notifications are blocked for HackRadar.', { action: { label: 'Open settings', onPress: () => Linking.openSettings() } });
    }
  };

  let account = 'Connecting…';
  if (user) account = 'Guest';
  else if (error) account = 'Offline';

  const radio = (selected, label, onPress) => (
    <Chip key={label} label={label} selected={selected} showRemove={false} role="radio" onPress={onPress} />
  );
  const pickAndClose = (patch) => {
    update(patch);
    close();
  };

  let sheetBody = null;
  if (open === 'themes') {
    sheetBody = (
      <Group label="Themes" note={lastThemeNote ? 'Keep at least one. Pick another before removing this one.' : 'Your Feed opens with these.'}>
        {THEMES.map(([k, label]) => (
          <Chip key={k} label={label} selected={themes.includes(k)} showRemove={false} onPress={() => toggleTheme(k)} />
        ))}
      </Group>
    );
  } else if (open === 'mode') {
    sheetBody = (
      <Group label="How do you want to join?" note={prefs.lat == null ? 'Until your city is set, the Feed shows online events.' : null}>
        {MODES.map(([label, modes]) => radio(same(prefs.modes || [], modes), label, () => pickAndClose({ modes })))}
      </Group>
    );
  } else if (open === 'fee') {
    sheetBody = (
      <Group label="Fee">
        {FEES.map(([label, fee]) => radio((prefs.fee_max === 0 ? 0 : null) === fee, label, () => pickAndClose({ fee_max: fee })))}
      </Group>
    );
  } else if (open === 'study') {
    const years = yearOptions(prefs.degree);
    sheetBody = (
      <>
        <Group label="Degree">{DEGREES.map((d) => radio(prefs.degree === d.key, d.label, () => pickDegree(d.key)))}</Group>
        {years.length ? (
          <Group label="Year">
            {years.map(([y, label]) => radio(prefs.year === y, label, () => update({ year: prefs.year === y ? null : y })))}
          </Group>
        ) : null}
      </>
    );
  } else if (open === 'look') {
    sheetBody = (
      <Group label="Theme" note={look === 'system' ? "Follows your phone's light or dark setting." : null}>
        {THEME_CHOICES.map(([key, label]) => radio(look === key, label, () => {
          setLook(key);
          close();
        }))}
      </Group>
    );
  } else if (open === 'distance') {
    sheetBody = (
      <Group label="For offline events" note={prefs.lat == null ? 'Applies once your city is set.' : null}>
        {DISTANCES.map(([km, label]) => radio(prefs.max_km === km, label, () => pickAndClose({ max_km: km })))}
      </Group>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="MY PREFERENCES" colors={colors}>
          <Row label="Interests" value={themes.map((t) => THEME_NAMES[t]).join(', ') || 'Not set'} onPress={() => setOpen('themes')} colors={colors} />
          <Row label="Mode" value={modeLabel} onPress={() => setOpen('mode')} colors={colors} />
          <Row label="Fee" value={prefs.fee_max === 0 ? 'Free only' : 'Free and paid'} onPress={() => setOpen('fee')} colors={colors} />
          <Row label="Degree and year" value={studyLabel} onPress={() => setOpen('study')} colors={colors} last />
        </Section>

        <Section title="LOCATION" colors={colors}>
          <Row label="City" value={place} onPress={() => setCityOpen(true)} colors={colors} />
          <Row
            label="Travel distance"
            value={DISTANCES.find(([km]) => km === prefs.max_km)?.[1] || 'Anywhere'}
            onPress={() => setOpen('distance')}
            colors={colors}
            last
          />
        </Section>

        <Section title="APPEARANCE" colors={colors}>
          <Row label="Theme" value={THEME_CHOICES.find(([k]) => k === look)?.[1]} onPress={() => setOpen('look')} colors={colors} last />
        </Section>

        <Section title="NOTIFICATIONS AND FEED" colors={colors}>
          <View style={styles.switches}>
            <SwitchRow
              label="Notifications"
              hint="Reminders before saved deadlines"
              value={!!prefs.notifications}
              onChange={setNotifications}
            />
            <SwitchRow
              label="Hide events with warnings"
              hint="Flagged for a high fee with no prize, no organizer or odd dates"
              value={!!prefs.hide_warnings}
              onChange={(v) => update({ hide_warnings: v })}
            />
          </View>
        </Section>

        <Section title="ABOUT" colors={colors}>
          <Row label="Hackathons from" value={SOURCES} colors={colors} />
          <Row label="Account" value={account} colors={colors} />
          <Row label="Version" value={Constants.expoConfig?.version || '1.0.0'} colors={colors} last />
        </Section>
        {error && !user ? <Button label="Retry connection" variant="secondary" onPress={retry} style={styles.retry} /> : null}

        <Text style={[type.meta, styles.credit, { color: colors.textSecondary }]} maxFontSizeMultiplier={CHROME_MAX_SCALE}>
          Place search by Photon (komoot) · City data © OpenStreetMap contributors
        </Text>
      </ScrollView>

      <Sheet visible={!!open} onClose={close} title={SHEET_TITLES[open] || ''}>
        {sheetBody}
      </Sheet>
      <CitySearch
        visible={cityOpen}
        onClose={() => setCityOpen(false)}
        onPick={(p) => {
          update(p);
          setCityOpen(false);
          toast(p.city ? `Location set to ${p.city}.` : 'Location set.');
        }}
        onRemove={prefs.city ? () => {
          update({ city: null, state: null, lat: null, lng: null });
          setCityOpen(false);
          toast('Location removed. The Feed shows online events.');
        } : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: layout.screenPadding, paddingBottom: space.xxl, gap: space.xl },
  section: { gap: space.sm },
  sectionTitle: { letterSpacing: 0.5, paddingHorizontal: space.xs },
  card: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 56 },
  rowLabel: { flexShrink: 0 },
  rowValue: { flex: 1, textAlign: 'right' },
  switches: { paddingVertical: space.xs },
  retry: { alignSelf: 'flex-start' },
  credit: { textAlign: 'center' },
});
