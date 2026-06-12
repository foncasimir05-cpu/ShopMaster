import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { forgotPassword, getSecurityQuestion, verifySecurityAnswer, resetPassword } from '../../services/api';

export default function ForgotScreen({ navigation }) {
  const { t } = useTranslation();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const [shops, setShops] = useState([]);
  const [selectedShopId, setSelectedShopId] = useState('');
  const [emailSentTo, setEmailSentTo] = useState('');

  const [otp, setOtp] = useState('');

  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [fetchingQuestion, setFetchingQuestion] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) return Alert.alert(t('common.error'), t('auth.forgot.errors.emailRequired'));
    setSending(true);
    try {
      const data = await forgotPassword(email.trim().toLowerCase());
      if (!data.shops || data.shops.length === 0) {
        Alert.alert(t('common.error'), t('auth.forgot.errors.notFound'));
        return;
      }
      setShops(data.shops);
      setSelectedShopId(data.shops[0].shopId);
      setEmailSentTo(email.trim().toLowerCase());

      if (data.requiresSecurityQuestion) {
        await loadSecurityQuestion(email.trim().toLowerCase(), data.shops[0].shopId);
        setStep('securityQuestion');
      } else {
        setStep('otp');
      }
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.error ?? t('common.connectionError'));
    } finally {
      setSending(false);
    }
  };

  const loadSecurityQuestion = async (emailAddr, shopId) => {
    setFetchingQuestion(true);
    setSecurityQuestion('');
    try {
      const data = await getSecurityQuestion(emailAddr, shopId);
      setSecurityQuestion(data.question);
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.error ?? t('common.genericError'));
    } finally {
      setFetchingQuestion(false);
    }
  };

  const handleShopSelect = async (shopId) => {
    setSelectedShopId(shopId);
    await loadSecurityQuestion(emailSentTo, shopId);
  };

  const handleVerifyAnswer = async () => {
    if (!securityAnswer.trim()) return Alert.alert(t('common.error'), t('auth.forgot.errors.answerRequired'));
    setVerifying(true);
    try {
      const data = await verifySecurityAnswer(emailSentTo, selectedShopId, securityAnswer.trim());
      setOtp(data.otp);
      setStep('newPassword');
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.error ?? t('common.genericError'));
    } finally {
      setVerifying(false);
    }
  };

  const handleOtpNext = () => {
    if (!otp.trim()) return Alert.alert(t('common.error'), t('auth.forgot.errors.otpRequired'));
    setStep('newPassword');
  };

  const handleReset = async () => {
    if (!newPassword) return Alert.alert(t('common.error'), t('auth.forgot.errors.newPasswordRequired'));
    if (newPassword.length < 8) return Alert.alert(t('common.error'), t('auth.forgot.errors.passwordTooShort'));
    if (newPassword !== confirmPassword) return Alert.alert(t('common.error'), t('auth.forgot.errors.passwordMismatch'));
    setResetting(true);
    try {
      await resetPassword(emailSentTo, selectedShopId, otp.trim(), newPassword);
      Alert.alert(
        t('auth.forgot.passwordReset'),
        t('auth.forgot.passwordResetSuccess'),
        [{ text: t('auth.forgot.goToLogin'), onPress: () => navigation.navigate('Login') }]
      );
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.error ?? t('common.genericError'));
    } finally {
      setResetting(false);
    }
  };

  const goBack = () => {
    if (step === 'otp' || step === 'securityQuestion') setStep('email');
    else if (step === 'newPassword') setStep(otp && shops.length ? 'otp' : 'securityQuestion');
    else navigation.goBack();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={goBack} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color="#1a2e4a" />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>{t('auth.forgot.title')}</Text>
          <Text style={styles.subtitle}>
            {step === 'email' && t('auth.forgot.subtitles.email')}
            {step === 'otp' && t('auth.forgot.subtitles.otp', { email: emailSentTo })}
            {step === 'securityQuestion' && t('auth.forgot.subtitles.securityQuestion')}
            {step === 'newPassword' && t('auth.forgot.subtitles.newPassword')}
          </Text>
        </View>

        <View style={styles.card}>

          {step === 'email' && (
            <>
              <Label>{t('auth.forgot.emailAddress')}</Label>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder={t('auth.login.emailPlaceholder')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {sending ? (
                <ActivityIndicator size="large" color="#1a2e4a" style={{ marginTop: 20 }} />
              ) : (
                <TouchableOpacity style={styles.btn} onPress={handleSend}>
                  <Text style={styles.btnText}>{t('auth.forgot.continue')}</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {step === 'otp' && (
            <>
              <View style={styles.infoBanner}>
                <Ionicons name="mail-outline" size={16} color="#1d4ed8" />
                <Text style={styles.infoText}>{t('auth.forgot.otpHint')}</Text>
              </View>

              <ShopPicker shops={shops} selected={selectedShopId} onSelect={setSelectedShopId} t={t} />

              <Label>{t('auth.forgot.otpCode')}</Label>
              <TextInput
                style={styles.input}
                value={otp}
                onChangeText={setOtp}
                placeholder="123456"
                keyboardType="number-pad"
                maxLength={6}
              />
              <TouchableOpacity style={styles.btn} onPress={handleOtpNext}>
                <Text style={styles.btnText}>{t('auth.forgot.continue')} →</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.resendBtn} onPress={() => { setStep('email'); setOtp(''); }}>
                <Text style={styles.resendText}>{t('auth.forgot.resend')}</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'securityQuestion' && (
            <>
              <View style={styles.warningBanner}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#92400e" />
                <Text style={styles.warningText}>{t('auth.forgot.securityWarning')}</Text>
              </View>

              <ShopPicker
                shops={shops}
                selected={selectedShopId}
                onSelect={handleShopSelect}
                t={t}
              />

              {fetchingQuestion ? (
                <ActivityIndicator size="small" color="#1a2e4a" style={{ marginVertical: 12 }} />
              ) : securityQuestion ? (
                <>
                  <Label>{t('auth.forgot.securityQuestion')}</Label>
                  <View style={styles.questionBox}>
                    <Text style={styles.questionText}>{securityQuestion}</Text>
                  </View>

                  <Label>{t('auth.forgot.yourAnswer')}</Label>
                  <TextInput
                    style={styles.input}
                    value={securityAnswer}
                    onChangeText={setSecurityAnswer}
                    placeholder={t('auth.forgot.answerPlaceholder')}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </>
              ) : null}

              {verifying ? (
                <ActivityIndicator size="large" color="#1a2e4a" style={{ marginTop: 20 }} />
              ) : (
                <TouchableOpacity
                  style={[styles.btn, !securityQuestion && styles.btnDisabled]}
                  onPress={handleVerifyAnswer}
                  disabled={!securityQuestion}
                >
                  <Text style={styles.btnText}>{t('auth.forgot.verifyIdentity')}</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {step === 'newPassword' && (
            <>
              <View style={styles.successBanner}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#065f46" />
                <Text style={styles.successText}>{t('auth.forgot.identityVerified')}</Text>
              </View>

              <Label>{t('auth.forgot.newPassword')}</Label>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder={t('auth.forgot.newPasswordPlaceholder')}
                secureTextEntry
              />
              <Label>{t('auth.forgot.confirmPassword')}</Label>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder={t('auth.forgot.confirmPasswordPlaceholder')}
                secureTextEntry
              />
              {resetting ? (
                <ActivityIndicator size="large" color="#1a2e4a" style={{ marginTop: 20 }} />
              ) : (
                <TouchableOpacity style={styles.btn} onPress={handleReset}>
                  <Text style={styles.btnText}>{t('auth.forgot.resetPassword')}</Text>
                </TouchableOpacity>
              )}
            </>
          )}

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Label({ children }) {
  return <Text style={styles.label}>{children}</Text>;
}

function ShopPicker({ shops, selected, onSelect, t }) {
  if (shops.length <= 1) {
    if (shops.length === 0) return null;
    return (
      <View style={styles.singleShop}>
        <Label>{t('auth.login.shopId')}</Label>
        <Text style={styles.shopName}>{shops[0].shopName}</Text>
        <Text style={styles.shopId}>{shops[0].shopId}</Text>
      </View>
    );
  }
  return (
    <>
      <Label>{t('auth.forgot.selectShop')}</Label>
      {shops.map(s => (
        <TouchableOpacity
          key={s.shopId}
          style={[styles.shopRow, selected === s.shopId && styles.shopRowSelected]}
          onPress={() => onSelect(s.shopId)}
        >
          <View style={[styles.radio, selected === s.shopId && styles.radioSelected]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.shopName}>{s.shopName}</Text>
            <Text style={styles.shopId}>{s.shopId}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#f3f4f6', padding: 24, paddingTop: 56 },
  back: { marginBottom: 16 },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: '800', color: '#111827', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#6b7280', lineHeight: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 4 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  btn: { backgroundColor: '#1a2e4a', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resendBtn: { alignItems: 'center', paddingVertical: 10 },
  resendText: { color: '#1a56db', fontSize: 13, fontWeight: '600' },
  infoBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#eff6ff', borderRadius: 8, padding: 12 },
  infoText: { flex: 1, color: '#1d4ed8', fontSize: 13 },
  warningBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef3c7', borderRadius: 8, padding: 12 },
  warningText: { flex: 1, color: '#92400e', fontSize: 13 },
  successBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#d1fae5', borderRadius: 8, padding: 12 },
  successText: { flex: 1, color: '#065f46', fontSize: 13 },
  questionBox: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 14 },
  questionText: { fontSize: 14, color: '#111827', fontStyle: 'italic' },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12 },
  shopRowSelected: { borderColor: '#1a2e4a', backgroundColor: '#f0f4ff' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#9ca3af' },
  radioSelected: { borderColor: '#1a2e4a', backgroundColor: '#1a2e4a' },
  singleShop: { gap: 2 },
  shopName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  shopId: { fontSize: 11, color: '#6b7280', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
