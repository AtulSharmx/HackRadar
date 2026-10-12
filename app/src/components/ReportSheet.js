import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { select, success, warn } from '../lib/haptics';
import { supabase } from '../lib/supabase';
import { layout, radius, space, type, useAppTheme } from '../theme';
import Button from './Button';
import Sheet from './Sheet';

// "Report wrong info" (launch audit, 10 Oct 2026): every listing is collected from other sites, so people
// need one tap to flag what's wrong. Saved in reports (migration 0016); the admin gets them on Telegram.
const REASONS = [
  ['wrong_dates', 'Dates or deadline are wrong'],
  ['wrong_place', 'Venue, city or mode is wrong'],
  ['closed', 'Registration is already closed'],
  ['fake', 'Looks fake or a scam'],
  ['duplicate', 'Listed twice'],
  ['other', 'Something else'],
];

export default function ReportSheet({ visible, onClose, eventId, onSent }) {
  const { colors } = useAppTheme();
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!visible) return;
    setReason(null);
    setNote('');
    setError(null);
  }, [visible]);

  const send = async () => {
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.from('reports').insert({ event_id: eventId, reason, note: note.trim() || null });
    setBusy(false);
    if (!e || e.code === '23505') { // 23505: already reported for this reason; that's fine too
      success();
      onSent(e ? 'You had already reported this. Thanks.' : 'Thanks. We will check it.');
      return;
    }
    warn();
    setError("Couldn't send. Check your connection and try again.");
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="What's wrong?"
      footer={<Button label={busy ? 'Sending…' : 'Send report'} onPress={send} disabled={!reason || busy} />}
    >
      <View>
        {REASONS.map(([key, label]) => {
          const on = reason === key;
          return (
            <Pressable
              key={key}
              onPress={() => {
                select();
                setReason(key);
              }}
              android_ripple={{ color: colors.border }}
              style={[styles.row, { borderBottomColor: colors.border }]}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={label}
            >
              <MaterialCommunityIcons name={on ? 'radiobox-marked' : 'radiobox-blank'} size={24} color={on ? colors.brand : colors.textSecondary} />
              <Text style={[type.body, { color: colors.textPrimary }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        value={note}
        onChangeText={setNote}
        maxLength={300}
        multiline
        placeholder="Anything that helps us fix it (optional)"
        placeholderTextColor={colors.textSecondary}
        style={[type.body, styles.note, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
        accessibilityLabel="Note"
      />
      {error ? <Text style={[type.meta, { color: colors.urgent }]}>{error}</Text> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTouch, borderBottomWidth: StyleSheet.hairlineWidth },
  note: { borderWidth: 1, borderRadius: radius.button, minHeight: 88, padding: space.md, textAlignVertical: 'top' },
});
