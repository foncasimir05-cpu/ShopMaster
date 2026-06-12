import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { BASE_ORIGIN } from '../../services/api';

const API = BASE_ORIGIN;

export default function RegisterShopScreen({ navigation }) {
  const { t } = useTranslation();
  const { login } = useAuth();
  const isSubmitting = useRef(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');

  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');

  const STEPS = [
    t('auth.register.steps.shopInfo'),
    t('auth.register.steps.ownerAccount'),
    t('auth.register.steps.security'),
  ];

  const SECURITY_QUESTIONS = [
    t('auth.register.questions.q1'),
    t('auth.register.questions.q2'),
    t('auth.register.questions.q3'),
    t('auth.register.questions.q4'),
    t('auth.register.questions.q5'),
  ];

  const validateStep0 = () => {
    const e = {};
    if (!shopName.trim()) e.shopName = t('auth.register.errors.shopNameRequired');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep1 = () => {
    const e = {};
    if (!ownerName.trim()) e.ownerName = t('auth.register.errors.nameRequired');
    if (!email.trim()) e.email = t('auth.register.errors.emailRequired');
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = t('auth.register.errors.emailInvalid');
    if (!password) e.password = t('auth.register.errors.passwordRequired');
    else if (password.length < 8) e.password = t('auth.register.errors.passwordTooShort');
    if (password !== confirmPassword) e.confirmPassword = t('auth.register.errors.passwordMismatch');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e = {};
    if (!securityQuestion) e.securityQuestion = t('auth.register.errors.securityQuestionRequired');
    if (!securityAnswer.trim()) e.securityAnswer = t('auth.register.errors.securityAnswerRequired');
    else if (securityAnswer.trim().length < 2) e.securityAnswer = t('auth.register.errors.securityAnswerTooShort');
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
      setError(err.message ?? t('auth.register.registrationFailed'));
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
          <Text style={styles.subtitle}>{t('auth.register.title')}</Text>
        </View>

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
              <Text style={styles.cardTitle}>{t('auth.register.shopDetails')}</Text>
              <Field
                label={t('auth.register.shopName')}
                value={shopName}
                onChangeText={v => { setShopName(v); setErrors(e => ({ ...e, shopName: null })); }}
                error={errors.shopName}
                placeholder={t('auth.register.shopNamePlaceholder')}
              />
              <TouchableOpacity style={styles.btn} onPress={() => { if (validateStep0()) setStep(1); }}>
                <Text style={styles.btnText}>{t('common.next')}</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 1 && (
            <>
              <Text style={styles.cardTitle}>{t('auth.register.yourAccount')}</Text>
              <Field label={t('auth.register.fullName')} value={ownerName}
                onChangeText={v => { setOwnerName(v); setErrors(e => ({ ...e, ownerName: null })); }}
                error={errors.ownerName} placeholder={t('auth.register.fullNamePlaceholder')} />
              <Field label={t('common.email')} value={email}
                onChangeText={v => { setEmail(v); setErrors(e => ({ ...e, email: null })); }}
                error={errors.email} placeholder="you@example.com"
                keyboardType="email-address" autoCapitalize="none" />
              <Field label={t('auth.login.password')} value={password}
                onChangeText={v => { setPassword(v); setErrors(e => ({ ...e, password: null })); }}
                error={errors.password} placeholder={t('auth.register.passwordPlaceholder')} secureTextEntry />
              <Field label={t('auth.register.confirmPassword')} value={confirmPassword}
                onChangeText={v => { setConfirmPassword(v); setErrors(e => ({ ...e, confirmPassword: null })); }}
                error={errors.confirmPassword} placeholder={t('auth.register.confirmPasswordPlaceholder')} secureTextEntry />
              <View style={styles.rowBtns}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setStep(0)}>
                  <Text style={styles.backBtnText}>← {t('common.back')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { flex: 1 }]}
                  onPress={() => { if (validateStep1()) setStep(2); }}>
                  <Text style={styles.btnText}>{t('common.next')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.cardTitle}>{t('auth.register.securityTitle')}</Text>
              <Text style={styles.securityHint}>{t('auth.register.securityHint')}</Text>

              <Text style={styles.label}>{t('auth.register.chooseQuestion')}</Text>
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

              <Field label={t('auth.register.yourAnswer')} value={securityAnswer}
                onChangeText={v => { setSecurityAnswer(v); setErrors(e => ({ ...e, securityAnswer: null })); }}
                error={errors.securityAnswer}
                placeholder={t('auth.register.answerPlaceholder')}
                autoCapitalize="none"
                autoCorrect={false} />

              <View style={styles.infoBanner}>
                <Ionicons name="lock-closed-outline" size={14} color="#1d4ed8" />
                <Text style={styles.infoText}>{t('auth.register.securityNote')}</Text>
              </View>

              {error ? <Text style={styles.submitError}>{error}</Text> : null}

              {loading ? (
                <ActivityIndicator size="large" color="#1a56db" style={{ marginTop: 20 }} />
              ) : (
                <View style={styles.rowBtns}>
                  <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
                    <Text style={styles.backBtnText}>← {t('common.back')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, { flex: 1 }]} onPress={handleRegister}>
                    <Text style={styles.btnText}>{t('auth.register.createShop')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>

        <TouchableOpacity style={styles.link} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.linkText}>
            {t('auth.register.alreadyHaveShop')} <Text style={styles.linkBold}>{t('auth.register.signIn')}</Text>
          </Text>
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
  questionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 8 },
  questionRowSelected: { borderColor: '#1a56db', backgroundColor: '#eff6ff' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#9ca3af', justifyContent: 'center', alignItems: 'center' },
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
