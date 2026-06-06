import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { BASE_ORIGIN } from '../../services/api';

const API = BASE_ORIGIN;

const STEPS = ['Shop Info', 'Owner Account', 'Security'];

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was the name of your first school?",
  "What was your childhood nickname?",
];

export default function RegisterShopScreen({ navigation }) {
  const { login } = useAuth();
  const isSubmitting = useRef(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');

  // Step 0
  const [shopName, setShopName] = useState('');
  // Step 1
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Step 2
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');

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

  const validateStep2 = () => {
    const e = {};
    if (!securityQuestion) e.securityQuestion = 'Please select a security question';
    if (!securityAnswer.trim()) e.securityAnswer = 'Answer is required';
    else if (securityAnswer.trim().length < 2) e.securityAnswer = 'Answer is too short';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    if (!validateStep2()) { isSubmitting.current = false; return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/auth/register-shop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopName: shopName.trim(),
          ownerName: ownerName.trim(),
          email: email.trim(),
          password,
          securityQuestion,
          securityAnswer: securityAnswer.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);
      await login({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
    } catch (err) {
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
          {step === 0 && (
            <>
              <Text style={styles.cardTitle}>Your shop details</Text>
              <Field
                label="Shop Name"
                value={shopName}
                onChangeText={v => { setShopName(v); setErrors(e => ({ ...e, shopName: null })); }}
                error={errors.shopName}
                placeholder="e.g. Acme General Store"
              />
              <TouchableOpacity style={styles.btn} onPress={() => { if (validateStep0()) setStep(1); }}>
                <Text style={styles.btnText}>Next →</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 1 && (
            <>
              <Text style={styles.cardTitle}>Your account</Text>
              <Field label="Full Name" value={ownerName}
                onChangeText={v => { setOwnerName(v); setErrors(e => ({ ...e, ownerName: null })); }}
                error={errors.ownerName} placeholder="Jane Smith" />
              <Field label="Email" value={email}
                onChangeText={v => { setEmail(v); setErrors(e => ({ ...e, email: null })); }}
                error={errors.email} placeholder="you@example.com"
                keyboardType="email-address" autoCapitalize="none" />
              <Field label="Password" value={password}
                onChangeText={v => { setPassword(v); setErrors(e => ({ ...e, password: null })); }}
                error={errors.password} placeholder="Min. 8 characters" secureTextEntry />
              <Field label="Confirm Password" value={confirmPassword}
                onChangeText={v => { setConfirmPassword(v); setErrors(e => ({ ...e, confirmPassword: null })); }}
                error={errors.confirmPassword} placeholder="Repeat password" secureTextEntry />
              <View style={styles.rowBtns}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setStep(0)}>
                  <Text style={styles.backBtnText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { flex: 1 }]}
                  onPress={() => { if (validateStep1()) setStep(2); }}>
                  <Text style={styles.btnText}>Next →</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.cardTitle}>Security question</Text>
              <Text style={styles.securityHint}>
                This is used to verify your identity if you ever forget your password and can't receive the reset email.
              </Text>

              <Text style={styles.label}>Choose a question</Text>
              {errors.securityQuestion ? <Text style={styles.errorText}>{errors.securityQuestion}</Text> : null}
              {SECURITY_QUESTIONS.map(q => (
                <TouchableOpacity
                  key={q}
                  style={[styles.questionRow, securityQuestion === q && styles.questionRowSelected]}
                  onPress={() => { setSecurityQuestion(q); setErrors(e => ({ ...e, securityQuestion: null })); }}
                >
                  <View style={[styles.radio, securityQuestion === q && styles.radioSelected]}>
                    {securityQuestion === q && <View style={styles.radioDot} />}
                  </View>
                  <Text style={styles.questionText}>{q}</Text>
                </TouchableOpacity>
              ))}

              <Field label="Your answer" value={securityAnswer}
                onChangeText={v => { setSecurityAnswer(v); setErrors(e => ({ ...e, securityAnswer: null })); }}
                error={errors.securityAnswer}
                placeholder="Type your answer"
                autoCapitalize="none"
                autoCorrect={false} />

              <View style={styles.infoBanner}>
                <Ionicons name="lock-closed-outline" size={14} color="#1d4ed8" />
                <Text style={styles.infoText}>Your answer is stored encrypted and is case-insensitive.</Text>
              </View>

              {error ? <Text style={styles.submitError}>{error}</Text> : null}

              {loading ? (
                <ActivityIndicator size="large" color="#1a56db" style={{ marginTop: 20 }} />
              ) : (
                <View style={styles.rowBtns}>
                  <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
                    <Text style={styles.backBtnText}>← Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, { flex: 1 }]} onPress={handleRegister}>
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
  stepLine: { width: 36, height: 2, backgroundColor: '#e5e7eb', marginHorizontal: 6, marginBottom: 18 },
  stepLineActive: { backgroundColor: '#1a56db' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 16 },
  securityHint: { fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  inputError: { borderColor: '#ef4444' },
  errorText: { color: '#ef4444', fontSize: 12, marginTop: 4, marginBottom: 4 },
  submitError: { color: '#ef4444', fontSize: 14, marginTop: 12, textAlign: 'center' },
  questionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    padding: 12, marginBottom: 8,
  },
  questionRowSelected: { borderColor: '#1a56db', backgroundColor: '#eff6ff' },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#9ca3af',
    justifyContent: 'center', alignItems: 'center',
  },
  radioSelected: { borderColor: '#1a56db' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1a56db' },
  questionText: { flex: 1, fontSize: 13, color: '#374151' },
  infoBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#eff6ff', borderRadius: 8, padding: 10, marginTop: 4, marginBottom: 12 },
  infoText: { flex: 1, color: '#1d4ed8', fontSize: 12 },
  rowBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btn: { backgroundColor: '#1a56db', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  backBtn: { backgroundColor: '#f3f4f6', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 18, justifyContent: 'center', marginTop: 8 },
  backBtnText: { color: '#374151', fontWeight: '600' },
  link: { marginTop: 24, alignItems: 'center' },
  linkText: { color: '#6b7280', fontSize: 14 },
  linkBold: { color: '#1a56db', fontWeight: '700' },
});
