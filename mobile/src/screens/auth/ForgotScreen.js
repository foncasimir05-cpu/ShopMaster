import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { forgotPassword, resetPassword } from '../../services/api';

export default function ForgotScreen({ navigation }) {
  const [step, setStep] = useState(1); // 1 = enter email, 2 = enter code + new password

  // Step 1
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  // Step 2
  const [shops, setShops] = useState([]);
  const [selectedShopId, setSelectedShopId] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [devOtp, setDevOtp] = useState('');
  const [emailSentTo, setEmailSentTo] = useState('');

  const handleSend = async () => {
    if (!email.trim()) return Alert.alert('Required', 'Please enter your email address.');
    setSending(true);
    try {
      const data = await forgotPassword(email.trim().toLowerCase());
      if (!data.shops || data.shops.length === 0) {
        Alert.alert('Not Found', 'No accounts found for this email address.');
        return;
      }
      setShops(data.shops);
      setSelectedShopId(data.shops[0].shopId);
      setEmailSentTo(email.trim().toLowerCase());
      if (data.devOtp) {
        setDevOtp(data.devOtp);
        setOtp(data.devOtp);
      }
      setStep(2);
    } catch {
      Alert.alert('Error', 'Could not send reset code. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleReset = async () => {
    if (!selectedShopId) return Alert.alert('Required', 'Please select a shop.');
    if (!otp.trim()) return Alert.alert('Required', 'Please enter the reset code from your email.');
    if (!newPassword) return Alert.alert('Required', 'Please enter a new password.');
    if (newPassword.length < 8) return Alert.alert('Too short', 'Password must be at least 8 characters.');
    if (newPassword !== confirmPassword) return Alert.alert('Mismatch', 'Passwords do not match.');
    setResetting(true);
    try {
      await resetPassword(emailSentTo, selectedShopId, otp.trim(), newPassword);
      Alert.alert(
        'Password Reset',
        'Your password has been reset. You can now log in.',
        [{ text: 'Go to Login', onPress: () => navigation.navigate('Login') }]
      );
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error ?? 'Reset failed. Please try again.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => step === 1 ? navigation.goBack() : setStep(1)} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color="#1a2e4a" />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Account Recovery</Text>
          <Text style={styles.subtitle}>
            {step === 1
              ? 'Enter your registered email to receive your Shop ID and a reset code.'
              : `A recovery email was sent to ${emailSentTo}.`}
          </Text>
        </View>

        {step === 1 ? (
          <View style={styles.card}>
            <Label>Email Address</Label>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {sending ? (
              <ActivityIndicator size="large" color="#1a2e4a" style={{ marginTop: 20 }} />
            ) : (
              <TouchableOpacity style={styles.btn} onPress={handleSend}>
                <Text style={styles.btnText}>Send Reset Code</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.card}>
            {devOtp ? (
              <View style={styles.devBanner}>
                <Text style={styles.devTitle}>Email not configured — test mode</Text>
                <Text style={styles.devText}>Your Shop ID and reset code are shown below (code auto-filled):</Text>
              </View>
            ) : (
              <View style={styles.infoBanner}>
                <Ionicons name="mail-outline" size={16} color="#1d4ed8" />
                <Text style={styles.infoText}>Check your email for your Shop ID(s) and 6-digit code.</Text>
              </View>
            )}

            {shops.length > 1 && (
              <>
                <Label>Select Shop</Label>
                {shops.map(s => (
                  <TouchableOpacity
                    key={s.shopId}
                    style={[styles.shopRow, selectedShopId === s.shopId && styles.shopRowSelected]}
                    onPress={() => setSelectedShopId(s.shopId)}
                  >
                    <View style={[styles.radio, selectedShopId === s.shopId && styles.radioSelected]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.shopName}>{s.shopName}</Text>
                      <Text style={styles.shopId}>{s.shopId}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {shops.length === 1 && (
              <View style={styles.singleShop}>
                <Label>Shop</Label>
                <Text style={styles.shopName}>{shops[0].shopName}</Text>
                <Text style={styles.shopId}>{shops[0].shopId}</Text>
              </View>
            )}

            <Label>6-Digit Reset Code</Label>
            <TextInput
              style={styles.input}
              value={otp}
              onChangeText={setOtp}
              placeholder="123456"
              keyboardType="number-pad"
              maxLength={6}
            />

            <Label>New Password</Label>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Min 8 characters"
              secureTextEntry
            />

            <Label>Confirm Password</Label>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repeat new password"
              secureTextEntry
            />

            {resetting ? (
              <ActivityIndicator size="large" color="#1a2e4a" style={{ marginTop: 20 }} />
            ) : (
              <>
                <TouchableOpacity style={styles.btn} onPress={handleReset}>
                  <Text style={styles.btnText}>Reset Password</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.resendBtn} onPress={() => { setStep(1); setOtp(''); setDevOtp(''); }}>
                  <Text style={styles.resendText}>Didn't get the code? Send again</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Label({ children }) {
  return <Text style={styles.label}>{children}</Text>;
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
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resendBtn: { alignItems: 'center', paddingVertical: 10 },
  resendText: { color: '#1a56db', fontSize: 13, fontWeight: '600' },
  infoBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#eff6ff', borderRadius: 8, padding: 12 },
  infoText: { flex: 1, color: '#1d4ed8', fontSize: 13 },
  devBanner: { backgroundColor: '#fef3c7', borderRadius: 8, padding: 12 },
  devTitle: { fontWeight: '700', color: '#92400e', fontSize: 13, marginBottom: 2 },
  devText: { color: '#78350f', fontSize: 12 },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12 },
  shopRowSelected: { borderColor: '#1a2e4a', backgroundColor: '#f0f4ff' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#9ca3af' },
  radioSelected: { borderColor: '#1a2e4a', backgroundColor: '#1a2e4a' },
  singleShop: { gap: 2 },
  shopName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  shopId: { fontSize: 11, color: '#6b7280', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
