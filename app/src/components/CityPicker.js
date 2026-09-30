import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Location from 'expo-location';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { findCity, searchCities } from '../lib/cities';
import { round2 } from '../lib/prefs';
import { layout, radius, space, type, useAppTheme } from '../theme';
import Button from './Button';

// "Use my location" + city search, shared by onboarding step 4 and Settings.
// Permission is asked only when "Use my location" is tapped (never on open).
// onPick({ city, state, lat, lng }): GPS gives my rounded position, search gives the city's centre.
// onSearchChange(open): lets the parent hide what the result list would push down.
export default function CityPicker({ onPick, searchFirst = false, onSearchChange }) {
  const { colors } = useAppTheme();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null); // { text, openSettings? }
  const [searching, setSearchingState] = useState(searchFirst);
  const [query, setQuery] = useState('');
  const setSearching = (v) => {
    setSearchingState(v);
    onSearchChange?.(v);
  };

  const pick = (place) => {
    setSearching(false);
    setQuery('');
    onPick(place);
  };

  const useGps = async () => {
    setNote(null);
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      setSearching(true);
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
      pick({
        city: known?.name || raw || null,
        state: addr?.region || known?.state || null,
        lat: round2(pos.coords.latitude),
        lng: round2(pos.coords.longitude),
      });
    } catch {
      setSearching(true);
      setNote({ text: "Couldn't get your location. Pick your city instead." });
    } finally {
      setBusy(false);
    }
  };

  const results = searchCities(query);
  return (
    <View style={styles.wrap}>
      <View style={styles.actions}>
        <Button label={busy ? 'Finding you…' : 'Use my location'} onPress={useGps} disabled={busy} />
        {busy ? <ActivityIndicator color={colors.brand} /> : null}
        {!searching ? <Button label="Choose city" variant="text" onPress={() => setSearching(true)} /> : null}
      </View>

      {note ? (
        <View style={styles.note}>
          <Text style={[type.body, { color: colors.textPrimary }]}>{note.text}</Text>
          {note.openSettings ? <Button label="Open settings" variant="text" onPress={() => Linking.openSettings()} /> : null}
        </View>
      ) : null}

      {searching ? (
        <View>
          <Text style={[type.meta, styles.label, { color: colors.textSecondary }]}>Search city</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoComplete="postal-address-locality"
            textContentType="addressCity"
            autoCapitalize="words"
            autoCorrect={false}
            placeholder="For example Pune"
            placeholderTextColor={colors.textSecondary}
            style={[type.body, styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
            accessibilityLabel="Search city"
          />
          {results.map((c) => (
            <Pressable
              key={`${c.name}-${c.state}`}
              onPress={() => pick({ city: c.name, state: c.state, lat: c.lat, lng: c.lng })}
              style={[styles.result, { borderBottomColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={`${c.name}, ${c.state}`}
            >
              <MaterialCommunityIcons name="map-marker-outline" size={20} color={colors.textSecondary} />
              <Text style={[type.body, { color: colors.textPrimary }]}>{c.name}</Text>
              <Text style={[type.meta, { color: colors.textSecondary }]}>{c.state}</Text>
            </Pressable>
          ))}
          {query.trim().length > 1 && !results.length ? (
            <Text style={[type.body, styles.none, { color: colors.textSecondary }]}>
              No city by that name in our list. Try a nearby bigger city.
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  actions: { gap: space.xs },
  note: { gap: space.xs },
  label: { marginBottom: space.xs },
  input: { borderWidth: 1, borderRadius: radius.button, minHeight: layout.minTouch, paddingHorizontal: space.md },
  result: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    minHeight: layout.minTouch, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  none: { paddingVertical: space.md },
});
