import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../components/Button';
import { useToast } from '../components/Toast';
import { explain, isEmail, sendCode, verifyCode } from '../lib/account';
import { success, warn } from '../lib/haptics';
import { layout, motion, radius, space, type, useAppTheme } from '../theme';

const RESEND_AFTER = 60; // seconds

// Sign in or create an account: email -> 6-digit code. One screen, two steps, no password.
export default function AccountScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [step, setStep] = useState('email'); // email | code
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState(null); // 'link' | 'signin', from sendCode
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (!wait) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      setMode(await sendCode(email));
      setStep('code');
      setCode('');
      setWait(RESEND_AFTER);
    } catch (e) {
      warn();
      setError(explain(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      const user = await verifyCode(email, code, mode);
      success();
      toast(`Signed in as ${user?.email || email.trim()}.`);
      router.back();
    } catch (e) {
      warn();
      setError(explain(e));
    } finally {
      setBusy(false);
    }
  };

  const field = [type.body, styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }];

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.badge, { backgroundColor: colors.brandSoft }]}>
          <MaterialCommunityIcons name={step === 'email' ? 'account-circle-outline' : 'email-check-outline'} size={32} color={colors.brand} />
        </View>

        {step === 'email' ? (
          <Animated.View key="email" entering={FadeInRight.duration(motion.base)} exiting={FadeOutLeft.duration(motion.fast)} style={styles.step}>
            <Text style={[type.screenTitle, { color: colors.textPrimary }]} accessibilityRole="header">
              Sign in or create an account
            </Text>
            <Text style={[type.body, { color: colors.textSecondary }]}>
              Use your email. We'll send a 6-digit code, no password needed. Your saved hackathons and preferences
              come with you to any phone.
            </Text>
            <TextInput
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setError(null);
              }}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              keyboardType="email-address"
              returnKeyType="send"
              onSubmitEditing={() => isEmail(email) && !busy && send()}
              placeholder="you@college.edu"
              placeholderTextColor={colors.textSecondary}
              style={field}
              accessibilityLabel="Email"
            />
            {error ? <Text style={[type.body, { color: colors.urgent }]} accessibilityRole="alert">{error}</Text> : null}
            <Button label={busy ? 'Sending…' : 'Send code'} onPress={send} disabled={busy || !isEmail(email)} />
          </Animated.View>
        ) : (
          <Animated.View key="code" entering={FadeInRight.duration(motion.base)} exiting={FadeOutLeft.duration(motion.fast)} style={styles.step}>
            <Text style={[type.screenTitle, { color: colors.textPrimary }]} accessibilityRole="header">
              Enter the code
            </Text>
            <Text style={[type.body, { color: colors.textSecondary }]}>
              Sent to <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{email.trim()}</Text>. It can take a
              minute; check spam too.
            </Text>
            <TextInput
              value={code}
              onChangeText={(t) => {
                setCode(t.replace(/\D/g, ''));
                setError(null);
              }}
              autoFocus
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={10}
              returnKeyType="done"
              onSubmitEditing={() => code.length >= 6 && !busy && verify()}
              placeholder="123456"
              placeholderTextColor={colors.border}
              style={[field, styles.code]}
              accessibilityLabel="Code from the email"
            />
            {error ? <Text style={[type.body, { color: colors.urgent }]} accessibilityRole="alert">{error}</Text> : null}
            <Button label={busy ? 'Checking…' : 'Verify and sign in'} onPress={verify} disabled={busy || code.length < 6} />
            <View style={styles.links}>
              <Button label="Change email" variant="text" onPress={() => { setStep('email'); setError(null); }} />
              <Button label={wait ? `Resend in ${wait}s` : 'Resend code'} variant="text" onPress={send} disabled={!!wait || busy} />
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: layout.screenPadding, paddingTop: space.xl, gap: space.xl },
  badge: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  step: { gap: space.md },
  input: { borderWidth: 1, borderRadius: radius.button, minHeight: 52, paddingHorizontal: space.md },
  code: { fontSize: 24, lineHeight: 30, letterSpacing: 8, textAlign: 'center', fontVariant: ['tabular-nums'] },
  links: { flexDirection: 'row', justifyContent: 'space-between' },
});
