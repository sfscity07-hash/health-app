import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { authErrorMessage, validateCredentials } from '@/features/auth/errors';
import { requireSupabase } from '@/lib/supabase';
import { useTheme } from '@/theme/theme';
import { gutter, radius, space } from '@/theme/tokens';

type Mode = 'sign-in' | 'sign-up';

const COPY: Record<Mode, { title: string; subtitle: string; submit: string; switchText: string; switchAction: string }> = {
  'sign-up': {
    title: 'Create your account',
    subtitle: 'Your log syncs to your own private Supabase database.',
    submit: 'Create account',
    switchText: 'Already have an account?',
    switchAction: 'Sign in',
  },
  'sign-in': {
    title: 'Welcome back',
    subtitle: 'Sign in to pick up where you left off.',
    submit: 'Sign in',
    switchText: 'New to Fuel?',
    switchAction: 'Create an account',
  },
};

export function AuthForm({ mode }: { mode: Mode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const copy = COPY[mode];
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const invalid = validateCredentials(email, password);
    setNotice(null);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const auth = requireSupabase().auth;
      const credentials = { email: email.trim().toLowerCase(), password };
      if (mode === 'sign-up') {
        const { data, error: e } = await auth.signUp(credentials);
        if (e) throw e;
        // With "Confirm email" switched on in Supabase, there's no session until the link is clicked.
        if (!data.session) setNotice('Check your inbox and tap the confirmation link, then come back and sign in.');
      } else {
        const { error: e } = await auth.signInWithPassword(credentials);
        if (e) throw e;
      }
      // On success the session changes and the app moves on to setup or your dashboard.
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.xl }]}>
        <IconButton icon="chevronLeft" label="Back" onPress={() => router.back()} />

        <View style={styles.header}>
          <Text variant="title" accessibilityRole="header">
            {copy.title}
          </Text>
          <Text variant="body" color="textSecondary">
            {copy.subtitle}
          </Text>
        </View>

        <View style={styles.fields}>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <TextField
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder={mode === 'sign-up' ? 'At least 8 characters' : 'Your password'}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
            textContentType={mode === 'sign-up' ? 'newPassword' : 'password'}
            returnKeyType="go"
            onSubmitEditing={submit}
            accessory={
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
                style={styles.show}>
                <Text variant="smallStrong" color="accent">
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </PressableScale>
            }
          />
        </View>

        {error ? (
          <Text variant="small" color="warn" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        {notice ? (
          <Card style={styles.notice}>
            <Text variant="small">{notice}</Text>
          </Card>
        ) : null}

        <View style={styles.actions}>
          <Button label={copy.submit} loading={busy} onPress={submit} />
          <View style={styles.switch}>
            <Text variant="small" color="textSecondary">
              {copy.switchText}
            </Text>
            <Button
              label={copy.switchAction}
              variant="ghost"
              onPress={() => router.replace(mode === 'sign-up' ? '/sign-in' : '/sign-up')}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: gutter, gap: space.xxl },
  header: { gap: space.sm },
  fields: { gap: space.lg },
  show: { paddingHorizontal: space.xs, paddingVertical: space.xs, borderRadius: radius.sm },
  notice: { padding: space.lg },
  actions: { marginTop: 'auto', gap: space.xs },
  switch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
