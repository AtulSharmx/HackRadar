import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../components/Button';
import Chip from '../components/Chip';
import CitySearch from '../components/CitySearch';
import Segmented from '../components/Segmented';
import { useToast } from '../components/Toast';
import { dateShort } from '../lib/format';
import { select, success, warn } from '../lib/haptics';
import { THEMES } from '../lib/labels';
import { useSession } from '../lib/session';
import { checkSubmission, emptySubmission } from '../lib/submission';
import { supabase } from '../lib/supabase';
import { layout, radius, space, type, useAppTheme } from '../theme';

// Submit a hackathon (launch audit, 10 Oct 2026): the college and club hackathons that live only on
// Instagram, WhatsApp or a Google Form. Signed-in accounts only, 5 a day (migration 0016); the admin
// reviews each one, and approved ones go live within a collector run (collector/community.py).
const MODES = [['online', 'Online'], ['offline', 'In person'], ['hybrid', 'Hybrid']];
const FEES = [['free', 'Free'], ['paid', 'Paid']];
const STATUS = { pending: ['In review', 'soon'], approved: ['Live', 'brand'], rejected: ['Not approved', 'urgent'] };

function Field({ label, hint, error, colors, ...input }) {
  return (
    <View style={styles.field}>
      <Text style={[type.label, { color: colors.textPrimary }]}>{label}</Text>
      {hint ? <Text style={[type.meta, { color: colors.textSecondary }]}>{hint}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textSecondary}
        style={[type.body, styles.input, { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: error ? colors.urgent : colors.border }]}
        accessibilityLabel={label}
        {...input}
      />
      {error ? <Text style={[type.meta, { color: colors.urgent }]}>{error}</Text> : null}
    </View>
  );
}

function Mine({ items, colors }) {
  if (!items.length) return null;
  return (
    <View style={styles.mine}>
      <Text style={[type.label, { color: colors.textPrimary }]}>Your submissions</Text>
      {items.map((s) => {
        const [word, tone] = s.status === 'pending' && new Date(s.registration_deadline) < new Date() ? ['Deadline passed', 'urgent'] : STATUS[s.status] || STATUS.pending;
        return (
          <View key={s.id} style={[styles.mineRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={styles.mineText}>
              <Text style={[type.body, { color: colors.textPrimary }]} numberOfLines={1}>{s.title}</Text>
              <Text style={[type.meta, { color: colors.textSecondary }]}>
                Sent {dateShort(s.created_at)}{s.review_note ? ` · ${s.review_note}` : ''}
              </Text>
            </View>
            <Text style={[type.label, { color: colors[tone] }]}>{word}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function SubmitScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user, isGuest } = useSession();
  const [f, setF] = useState(emptySubmission);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [mine, setMine] = useState([]);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));

  const loadMine = useCallback(async () => {
    if (!user || isGuest) return;
    const { data } = await supabase.from('submissions').select('id,title,status,review_note,created_at,registration_deadline')
      .order('created_at', { ascending: false }).limit(20);
    setMine(data || []);
  }, [user, isGuest]);
  useEffect(() => {
    loadMine();
  }, [loadMine]);

  const submit = async () => {
    const { errors: e, row } = checkSubmission(f);
    setErrors(e);
    if (!row) {
      warn();
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('submissions').insert(row);
    setBusy(false);
    if (error) {
      warn();
      const limit = /row-level security/i.test(error.message || '');
      toast(limit ? 'You can submit 5 hackathons a day. Try again tomorrow.' : "Couldn't send. Check your connection and try again.");
      return;
    }
    success();
    setF(emptySubmission);
    loadMine();
    toast("Sent. We'll check it and it goes live once approved.");
  };

  if (isGuest) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: colors.background }]}>
        <MaterialCommunityIcons name="account-check-outline" size={32} color={colors.textSecondary} />
        <Text style={[type.cardTitle, styles.centerText, { color: colors.textPrimary }]}>Sign in to submit a hackathon</Text>
        <Text style={[type.body, styles.centerText, { color: colors.textSecondary }]}>
          So we can keep spam out and tell you when yours goes live.
        </Text>
        <Button label="Sign in" onPress={() => router.push('/account')} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]} keyboardShouldPersistTaps="handled">
        <Text style={[type.body, { color: colors.textSecondary }]}>
          Know a hackathon that isn't on HackRadar, like one shared only on Instagram or WhatsApp? Add it here.
          We check every submission before it goes live.
        </Text>

        <Field label="Name" value={f.title} onChangeText={(t) => set({ title: t })} maxLength={200} error={errors.title} colors={colors} placeholder="HackSGT 2026" />
        <Field
          label="Registration link"
          value={f.registration_url}
          onChangeText={(t) => set({ registration_url: t })}
          error={errors.registration_url}
          colors={colors}
          placeholder="https://forms.gle/…"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          maxLength={500}
        />
        <Field label="Organised by" value={f.organizer} onChangeText={(t) => set({ organizer: t })} maxLength={150} error={errors.organizer} colors={colors} placeholder="College, club or company" />

        <View style={styles.field}>
          <Text style={[type.label, { color: colors.textPrimary }]}>How people join</Text>
          <Segmented options={MODES} value={f.mode} onChange={(mode) => set({ mode })} accessibilityLabel="How people join" />
        </View>
        {f.mode !== 'online' ? (
          <View style={styles.field}>
            <Text style={[type.label, { color: colors.textPrimary }]}>City</Text>
            <Pressable
              onPress={() => {
                select();
                setCityOpen(true);
              }}
              style={[styles.input, styles.cityBtn, { backgroundColor: colors.surface, borderColor: errors.city ? colors.urgent : colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={f.city ? `City, ${f.city}. Change` : 'Choose the city'}
            >
              <MaterialCommunityIcons name="map-marker-outline" size={20} color={colors.brand} />
              <Text style={[type.body, { color: f.city ? colors.textPrimary : colors.textSecondary }]}>{f.city || 'Choose the city'}</Text>
            </Pressable>
            {errors.city ? <Text style={[type.meta, { color: colors.urgent }]}>{errors.city}</Text> : null}
          </View>
        ) : null}

        <Field label="Registration closes" hint="DD/MM/YYYY" value={f.deadline} onChangeText={(t) => set({ deadline: t })} error={errors.deadline} colors={colors} placeholder="25/10/2026" keyboardType="numbers-and-punctuation" maxLength={10} />
        <View style={styles.pair}>
          <View style={styles.half}>
            <Field label="Starts (optional)" value={f.start} onChangeText={(t) => set({ start: t })} error={errors.start} colors={colors} placeholder="DD/MM/YYYY" keyboardType="numbers-and-punctuation" maxLength={10} />
          </View>
          <View style={styles.half}>
            <Field label="Ends (optional)" value={f.end} onChangeText={(t) => set({ end: t })} error={errors.end} colors={colors} placeholder="DD/MM/YYYY" keyboardType="numbers-and-punctuation" maxLength={10} />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={[type.label, { color: colors.textPrimary }]}>Entry fee</Text>
          <Segmented options={FEES} value={f.fee} onChange={(fee) => set({ fee })} accessibilityLabel="Entry fee" />
        </View>
        {f.fee === 'paid' ? (
          <Field label="Fee in rupees" value={f.fee_amount} onChangeText={(t) => set({ fee_amount: t })} error={errors.fee_amount} colors={colors} placeholder="200" keyboardType="number-pad" maxLength={6} />
        ) : null}
        <Field label="Prizes (optional)" value={f.prize_text} onChangeText={(t) => set({ prize_text: t })} error={errors.prize_text} colors={colors} placeholder="₹50,000 in prizes" maxLength={200} />
        <Field label="Who can join (optional)" value={f.eligibility_text} onChangeText={(t) => set({ eligibility_text: t })} error={errors.eligibility_text} colors={colors} placeholder="Any college student, teams of 2 to 4" maxLength={300} />

        <View style={styles.field}>
          <Text style={[type.label, { color: colors.textPrimary }]}>Themes (optional)</Text>
          <View style={styles.chips}>
            {THEMES.map(([k, label]) => (
              <Chip
                key={k}
                label={label}
                selected={f.themes.includes(k)}
                showRemove={false}
                onPress={() => set({ themes: f.themes.includes(k) ? f.themes.filter((t) => t !== k) : [...f.themes, k] })}
              />
            ))}
          </View>
        </View>

        <Button label={busy ? 'Sending…' : 'Submit for review'} onPress={submit} disabled={busy} />
        <Mine items={mine} colors={colors} />
      </ScrollView>

      <CitySearch
        visible={cityOpen}
        onClose={() => setCityOpen(false)}
        onPick={(p) => {
          set({ city: p.city });
          setCityOpen(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: layout.screenPadding, gap: space.lg },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.md },
  centerText: { textAlign: 'center' },
  field: { gap: space.xs },
  input: { borderWidth: 1, borderRadius: radius.button, minHeight: layout.minTouch, paddingHorizontal: space.md },
  cityBtn: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pair: { flexDirection: 'row', gap: space.md },
  half: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  mine: { gap: space.sm, marginTop: space.md },
  mineRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderRadius: radius.card, padding: space.md },
  mineText: { flex: 1 },
});
