import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { BASE_ORIGIN } from '../../services/api';

const API = BASE_ORIGIN;

const STEPS = ['Shop Info', 'Owner Account'];

export default function RegisterShopScreen({ navigation }) {
  const { login } = useAuth();
  const isSubmitting = useRef(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');

  // Step 0 fields
  const [shopName, setShopName] = useState('');
  // Step 1 fields
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const validateStep0 = () => {
    const e = {};
    if (!shopName.trim()) e.shopName = 'Shop name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep1 = () => {
    const e = {};
    if (!ownerName.trim()) e.ownerName = 'Your name is required';
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'At least 8 characters';
    if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (validateStep0()) setStep(1);
  };

  const handleRegister = async () => {
    console.log('Submit pressed', { shopName, ownerName, email, step });
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    if (!validateStep1()) {
      isSubmitting.current = false;
      return;
    }
    setLoading(true);
    setError('');
    try {
      const body = JSON.stringify({
        shopName: shopName.trim(),
        ownerName: ownerName.trim(),
        email: email.trim(),
        password,
      });
      console.log('Calling register-shop:', `${API}/api/auth/register-shop`, body);
      const res = await fetch(`${API}/api/auth/register-shop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const data = await res.json();
      console.log('Register response:', res.status, data);
      if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);

      console.log('About to call login...');
      await login({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      });
      console.log('Login called, checking navigation...');
    } catch (err) {
      console.error('Register error:', err);
      setError(err.message ?? 'Registration failed');
    } finally {
      setLoading(false);
      isSubmitting.current = false;
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>ShopMaster</Text>
          <Text style={styles.subtitle}>Set up your shop</Text>
        </View>

        {/* Step indicator */}
        <View style={styles.stepRow}>
          {STEPS.map((label, i) => (
            <React.Fragment key={label}>
              <View style={styles.stepItem}>
                <View style={[styles.stepDot, i <= step && styles.stepDotActive]}>
                  <Text style={[styles.stepNum, i <= step && styles.stepNumActive]}>{i + 1}</Text>
                </View>
                <Text style={[styles.stepLabel, i === step && styles.stepLabelActive]}>{label}</Text>
              </View>
              {i < STEPS.length - 1 && <View style={[styles.stepLine, i < step && styles.stepLineActive]} />}
            </React.Fragment>
          ))}
        </View>

        <View style={styles.card}>
          {step === 0 ? (
            <>
              <Text style={styles.cardTitle}>Your shop details</Text>
              <Field
                label="Shop Name"
                value={shopName}
                onChangeText={v => { setShopName(v); setErrors(e => ({ ...e, shopName: null })); }}
                error={errors.shopName}
                placeholder="e.g. Acme General Store"
              />
              <TouchableOpacity style={styles.btn} onPress={handleNext}>
                <Text style={styles.btnText}>Next →</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.cardTitle}>Your account</Text>
              <Field
                label="Full Name"
                value={ownerName}
                onChangeText={v => { setOwnerName(v); setErrors(e => ({ ...e, ownerName: null })); }}
                error={errors.ownerName}
                placeholder="Jane Smith"
              />
              <Field
                label="Email"
                value={email}
                onChangeText={v => { setEmail(v); setErrors(e => ({ ...e, email: null })); }}
                error={errors.email}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Field
                label="Password"
                value={password}
                onChangeText={v => { setPassword(v); setErrors(e => ({ ...e, password: null })); }}
                error={errors.password}
                placeholder="Min. 8 characters"
                secureTextEntry
              />
              <Field
                label="Confirm Password"
                value={confirmPassword}
                onChangeText={v => { setConfirmPassword(v); setErrors(e => ({ ...e, confirmPassword: null })); }}
                error={errors.confirmPassword}
                placeholder="Repeat password"
                secureTextEntry
              />

              {error ? <Text style={styles.submitError}>{error}</Text> : null}

              {loading ? (
                <ActivityIndicator size="large" color="#1a56db" style={{ marginTop: 20 }} />
              ) : (
                <View style={styles.rowBtns}>
                  <TouchableOpacity style={styles.backBtn} onPress={() => setStep(0)}>
                    <Text style={styles.backBtnText}>← Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, { flex: 1 }]} onPress={handleRegister} disabled={loading}>
                    <Text style={styles.btnText}>Create Shop</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>

        <TouchableOpacity style={styles.link} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.linkText}>Already have a shop? <Text style={styles.linkBold}>Sign in →</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, error, ...props }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={[styles.input, error && styles.inputError]} {...props} />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#f3f4f6', padding: 24, paddingTop: 60 },
  header: { alignItems: 'center', marginBottom: 28 },
  logo: { fontSize: 32, fontWeight: '800', color: '#1a56db', letterSpacing: -1 },
  subtitle: { fontSize: 15, color: '#6b7280', marginTop: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  stepItem: { alignItems: 'center' },
  stepDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center' },
  stepDotActive: { backgroundColor: '#1a56db' },
  stepNum: { fontSize: 13, fontWeight: '700', color: '#9ca3af' },
  stepNumActive: { color: '#fff' },
  stepLabel: { fontSize: 11, color: '#9ca3af', marginTop: 4, fontWeight: '500' },
  stepLabelActive: { color: '#1a56db' },
  stepLine: { width: 48, height: 2, backgroundColor: '#e5e7eb', marginHorizontal: 6, marginBottom: 18 },
  stepLineActive: { backgroundColor: '#1a56db' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  inputError: { borderColor: '#ef4444' },
  errorText: { color: '#ef4444', fontSize: 12, marginTop: 4 },
  submitError: { color: '#ef4444', fontSize: 14, marginTop: 12, textAlign: 'center' },
  rowBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btn: { backgroundColor: '#1a56db', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  backBtn: { backgroundColor: '#f3f4f6', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 18, justifyContent: 'center', marginTop: 8 },
  backBtnText: { color: '#374151', fontWeight: '600' },
  link: { marginTop: 24, alignItems: 'center' },
  linkText: { color: '#6b7280', fontSize: 14 },
  linkBold: { color: '#1a56db', fontWeight: '700' },
});
