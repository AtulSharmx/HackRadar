import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import Button from '../../components/Button';
import CitySearch from '../../components/CitySearch';
import OnboardingStep, { Group } from '../../components/OnboardingStep';
import Segmented from '../../components/Segmented';
import { findCity } from '../../lib/cities';
import { useDraft } from '../../lib/draft';
import { success, warn } from '../../lib/haptics';
import { locateMe } from '../../lib/places';
import { layout, radius, space, type, useAppTheme } from '../../theme';

const DISTANCES = [[10, '10'], [25, '25'], [50, '50'], [100, '100'], [null, 'Any']];

function Field({ label, value, onChangeText, autoComplete, textContentType, colors }) {
  return (
    <View style={styles.field}>
      <Text style={[type.meta, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        value={value || ''}
        onChangeText={onChangeText}
        autoComplete={autoComplete}
        textContentType={textContentType}
        autoCapitalize="words"
        style={[type.body, styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel={label}
      />
    </View>
  );
}

// Step 4. Permission is asked only when "Use my location" is tapped (never on open).
export default function LocationStep() {
  const { colors } = useAppTheme();
  const { draft, update } = useDraft();
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null); // { text, openSettings? }

  const useGps = async () => {
    setNote(null);
    setBusy(true);
    try {
      const found = await locateMe();
      if (found.denied) {
        warn();
        setNote(found.canAskAgain
          ? { text: 'No problem, search for your city.' }
          : { text: 'Location is off for HackRadar. You can still search for your city.', openSettings: true });
        return;
      }
      success();
      update(found);
    } catch {
      warn();
      setNote({ text: "Couldn't get your location. Search for your city instead." });
    } finally {
      setBusy(false);
    }
  };

  // GPS can still name the wrong city: the fields stay editable, and a known city name brings its coordinates
  const editCity = (text) => {
    const known = findCity(text);
    update(known ? { city: text, state: known.state, lat: known.lat, lng: known.lng } : { city: text });
  };

  const next = () => router.push('/notifications');
  const skip = () => {
    update({ city: null, state: null, lat: null, lng: null });
    next();
  };

  return (
    <OnboardingStep
      step={4}
      title="Where are you?"
      subtitle="Used only to show how far offline hackathons are. Stored as your city, about 1 km accurate."
      next={{ label: 'Next', onPress: next, disabled: !draft.city }}
      skip={skip}
    >
      <View style={styles.actions}>
        <Button label={busy ? 'Finding you…' : 'Use my location'} onPress={useGps} disabled={busy} />
        {/* looks like a search box: tapping opens the full-screen search with suggestions under the box */}
        <Pressable
          onPress={() => setSearching(true)}
          style={[styles.fakeSearch, { borderColor: colors.border, backgroundColor: colors.surface }]}
          accessibilityRole="button"
          accessibilityLabel="Search your city or area"
        >
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textSecondary} />
          <Text style={[type.body, { color: colors.textSecondary }]}>Search your city or area</Text>
        </Pressable>
      </View>

      {note ? (
        <View style={styles.note}>
          <Text style={[type.body, { color: colors.textPrimary }]}>{note.text}</Text>
          {note.openSettings ? <Button label="Open settings" variant="text" onPress={() => Linking.openSettings()} /> : null}
        </View>
      ) : null}

      {draft.city != null ? (
        <View style={styles.fields}>
          <Field label="City" value={draft.city} onChangeText={editCity} autoComplete="postal-address-locality" textContentType="addressCity" colors={colors} />
          <Field label="State" value={draft.state} onChangeText={(t) => update({ state: t })} autoComplete="postal-address-region" textContentType="addressState" colors={colors} />
        </View>
      ) : null}

      <Group label="How far can you travel? (km)">
        <Segmented options={DISTANCES} value={draft.max_km ?? null} onChange={(km) => update({ max_km: km })} accessibilityLabel="How far can you travel" />
      </Group>

      <CitySearch
        visible={searching}
        onClose={() => setSearching(false)}
        onPick={(place) => {
          update(place);
          setSearching(false);
        }}
      />
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  actions: { gap: space.md },
  fakeSearch: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTouch,
    borderWidth: 1, borderRadius: radius.button, paddingHorizontal: space.md,
  },
  note: { gap: space.xs },
  fields: { flexDirection: 'row', gap: space.md },
  field: { flex: 1, gap: space.xs },
  input: { borderWidth: 1, borderRadius: radius.button, minHeight: layout.minTouch, paddingHorizontal: space.md },
});
