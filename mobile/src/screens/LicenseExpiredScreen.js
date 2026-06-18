import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { activateLicense } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function LicenseExpiredScreen() {
  const { logout, refreshLicense } = useAuth();
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleActivate = async () => {
    const trimmed = key.trim();
    if (!trimmed) { setError('Please enter your license key.'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await activateLicense(trimmed);
      refreshLicense(result);
    } catch (err) {
      setError(err.response?.data?.error ?? 'Could not activate key. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.iconWrap}>
          <Ionicons name="lock-closed" size={48} color="#d97706" />
        </View>

        <Text style={styles.title}>Trial Ended</Text>
        <Text style={styles.subtitle}>
          Your 30-day free trial has expired.{'\n'}
          Enter your license key to continue using ShopMaster.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>License Key</Text>
          <TextInput
            style={styles.input}
            value={key}
            onChangeText={v => { setKey(v); setError(''); }}
            placeholder="SMPR-XXXXXXXX-XXXXXXXX-XXXXXXXX"
            placeholderTextColor="#9ca3af"
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel="License key input"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleActivate}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Activate license"
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Activate License</Text>}
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          Don't have a key? Contact your ShopMaster provider to purchase one.
        </Text>

        <TouchableOpacity
          style={styles.logoutLink}
          onPress={logout}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1, backgroundColor: '#fafafa',
    alignItems: 'center', justifyContent: 'center',
    padding: 28, paddingTop: 64, paddingBottom: 48,
  },
  iconWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#fffbeb', justifyContent: 'center', alignItems: 'center',
    marginBottom: 20, borderWidth: 2, borderColor: '#fde68a',
  },
  title: { fontSize: 26, fontWeight: '800', color: '#111827', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  card: {
    width: '100%', backgroundColor: '#fff', borderRadius: 16,
    padding: 20, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
    marginBottom: 20,
  },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  input: {
    backgroundColor: '#f9fafb', borderWidth: 1.5, borderColor: '#d1d5db',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#111827', letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 12,
  },
  error: { color: '#dc2626', fontSize: 13, marginBottom: 10 },
  btn: {
    backgroundColor: '#1a2e4a', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  hint: { fontSize: 12, color: '#9ca3af', textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  logoutLink: { padding: 8 },
  logoutText: { color: '#dc2626', fontSize: 13, fontWeight: '600' },
});
