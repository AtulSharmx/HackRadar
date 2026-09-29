import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import Button from '../../components/Button';
import Chip from '../../components/Chip';
import OnboardingStep, { Group } from '../../components/OnboardingStep';
import { findCity, searchCities } from '../../lib/cities';
import { useDraft } from '../../lib/draft';
import { round2 } from '../../lib/prefs';
import { layout, radius, space, type, useAppTheme } from '../../theme';

const DISTANCES = [[10, '10 km'], [25, '25 km'], [50, '50 km'], [100, '100 km'], [null, 'Anywhere']];

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
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null); // { text, openSettings? }
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');

  const pickCity = (c) => {
    update({ city: c.name, state: c.state, lat: c.lat, lng: c.lng });
    setPicking(false);
    setQuery('');
  };

  const useGps = async () => {
    setNote(null);
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      setPicking(true);
      setNote(perm.canAskAgain
        ? { text: 'No problem, pick your city.' }
        : { text: 'Location is off for HackRadar. You can still pick your city.', openSettings: true });
      return;
    }
    setBusy(true);
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [addr] = await Location.reverseGeocodeAsync(pos.coords);
      const raw = addr?.city || addr?.subregion || '';
      const known = findCity(raw); // "Gurgaon" -> Gurugram
      update({
        city: known?.name || raw || null,
        state: addr?.region || known?.state || null,
        lat: round2(pos.coords.latitude),
        lng: round2(pos.coords.longitude),
      });
    } catch {
      setPicking(true);
      setNote({ text: "Couldn't get your location. Pick your city instead." });
    } finally {
      setBusy(false);
    }
  };

  // GPS can guess the wrong city: the fields stay editable, and a known city name brings its coordinates
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
        {busy ? <ActivityIndicator color={colors.brand} /> : null}
        <Button label="Choose city" variant="text" onPress={() => setPicking(true)} />
      </View>

      {note ? (
        <View style={styles.note}>
          <Text style={[type.body, { color: colors.textPrimary }]}>{note.text}</Text>
          {note.openSettings ? <Button label="Open settings" variant="text" onPress={() => Linking.openSettings()} /> : null}
        </View>
      ) : null}

      {picking ? (
        <View style={styles.search}>
          <Field label="Search city" value={query} onChangeText={setQuery} autoComplete="postal-address-locality" textContentType="addressCity" colors={colors} />
          {searchCities(query).map((c) => (
            <Pressable
              key={c.name}
              onPress={() => pickCity(c)}
              style={[styles.result, { borderBottomColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={`${c.name}, ${c.state}`}
            >
              <MaterialCommunityIcons name="map-marker-outline" size={20} color={colors.textSecondary} />
              <Text style={[type.body, { color: colors.textPrimary }]}>{c.name}</Text>
              <Text style={[type.meta, { color: colors.textSecondary }]}>{c.state}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {draft.city != null && !picking ? (
        <View style={styles.fields}>
          <Field label="City" value={draft.city} onChangeText={editCity} autoComplete="postal-address-locality" textContentType="addressCity" colors={colors} />
          <Field label="State" value={draft.state} onChangeText={(t) => update({ state: t })} autoComplete="postal-address-region" textContentType="addressState" colors={colors} />
        </View>
      ) : null}

      <Group label="How far can you travel?">
        {DISTANCES.map(([km, label]) => (
          <Chip key={label} label={label} role="radio" showRemove={false} selected={draft.max_km === km} onPress={() => update({ max_km: km })} />
        ))}
      </Group>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  actions: { gap: space.xs },
  note: { gap: space.xs },
  search: { gap: 0 },
  result: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    minHeight: layout.minTouch, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fields: { flexDirection: 'row', gap: space.md },
  field: { flex: 1, gap: space.xs },
  input: { borderWidth: 1, borderRadius: radius.button, minHeight: layout.minTouch, paddingHorizontal: space.md },
});
