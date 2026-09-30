import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import Chip from '../../components/Chip';
import CityPicker from '../../components/CityPicker';
import OnboardingStep, { Group } from '../../components/OnboardingStep';
import { findCity } from '../../lib/cities';
import { useDraft } from '../../lib/draft';
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
  const [searching, setSearching] = useState(false);

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
      <CityPicker onPick={update} onSearchChange={setSearching} />

      {draft.city != null && !searching ? (
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
  fields: { flexDirection: 'row', gap: space.md },
  field: { flex: 1, gap: space.xs },
  input: { borderWidth: 1, borderRadius: radius.button, minHeight: layout.minTouch, paddingHorizontal: space.md },
});
