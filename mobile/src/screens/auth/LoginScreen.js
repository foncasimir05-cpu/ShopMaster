import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { BASE_ORIGIN } from '../../services/api';

const API = BASE_ORIGIN;

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [shopId, setShopId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!shopId.trim()) e.shopId = 'Shop ID is required';
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, shopId: shopId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Login failed');
      await login(data);
    } catch (err) {
      Alert.alert('Login failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>ShopMaster</Text>
          <Text style={styles.subtitle}>Sign in to your shop</Text>
        </View>

        <View style={styles.card}>
          <Field
            label="Shop ID"
            value={shopId}
            onChangeText={v => { setShopId(v); setErrors(e => ({ ...e, shopId: null })); }}
            error={errors.shopId}
            placeholder="Paste your Shop ID"
            autoCapitalize="none"
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
            placeholder="••••••••"
            secureTextEntry
          />

          {loading ? (
            <ActivityIndicator size="large" color="#1a56db" style={{ marginTop: 20 }} />
          ) : (
            <TouchableOpacity style={styles.btn} onPress={handleLogin}>
              <Text style={styles.btnText}>Sign In</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.link} onPress={() => navigation.navigate('RegisterShop')}>
          <Text style={styles.linkText}>No shop yet? <Text style={styles.linkBold}>Create one →</Text></Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.link} onPress={() => navigation.navigate('Forgot')}>
          <Text style={styles.linkText}>Forgot password or Shop ID? <Text style={styles.linkBold}>Recover account →</Text></Text>
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
  container: { flexGrow: 1, backgroundColor: '#f3f4f6', padding: 24, paddingTop: 72 },
  header: { alignItems: 'center', marginBottom: 36 },
  logo: { fontSize: 36, fontWeight: '800', color: '#1a56db', letterSpacing: -1 },
  subtitle: { fontSize: 16, color: '#6b7280', marginTop: 6 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  inputError: { borderColor: '#ef4444' },
  errorText: { color: '#ef4444', fontSize: 12, marginTop: 4 },
  btn: { backgroundColor: '#1a56db', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link: { marginTop: 24, alignItems: 'center' },
  linkText: { color: '#6b7280', fontSize: 14 },
  linkBold: { color: '#1a56db', fontWeight: '700' },
});
