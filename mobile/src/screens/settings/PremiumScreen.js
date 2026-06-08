import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { initiatePremiumPayment, checkPremiumPaymentStatus, getPremiumStatus } from '../../services/api';

const PLANS = [
  {
    key: 'monthly',
    label: 'Monthly',
    price: '9,000 XAF',
    sub: 'per month — cancel anytime',
    saving: null,
  },
  {
    key: 'annual',
    label: 'Annual',
    price: '108,000 XAF',
    sub: 'per year — same as monthly',
    saving: 'Best Value',
  },
];

const FEATURES = [
  'Manage multiple branch locations',
  'Separate stock & sales per branch',
  'Staff accounts per branch',
  'Unified owner dashboard',
];

export default function PremiumScreen({ navigation }) {
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState('select'); // select | pending | success | failed
  const [paymentRef, setPaymentRef] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const pollRef = useRef(null);

  // Load existing subscription info
  useEffect(() => {
    getPremiumStatus().then(p => {
      if (p.isPremium && p.subscriptionExpiresAt) {
        setExpiresAt(p.subscriptionExpiresAt);
        setStep('success');
      }
    }).catch(() => {});
  }, []);

  // Poll for payment confirmation
  useEffect(() => {
    if (step !== 'pending' || !paymentRef) return;

    pollRef.current = setInterval(async () => {
      try {
        const result = await checkPremiumPaymentStatus(paymentRef);
        setPollCount(c => c + 1);

        if (result.status === 'successful') {
          clearInterval(pollRef.current);
          setExpiresAt(result.expiresAt);
          setStep('success');
        } else if (result.status === 'failed') {
          clearInterval(pollRef.current);
          setStep('failed');
        }
      } catch {}
    }, 5000); // check every 5 seconds

    return () => clearInterval(pollRef.current);
  }, [step, paymentRef]);

  // Stop polling after 3 minutes
  useEffect(() => {
    if (step !== 'pending') return;
    const timeout = setTimeout(() => {
      clearInterval(pollRef.current);
      setStep('failed');
    }, 3 * 60 * 1000);
    return () => clearTimeout(timeout);
  }, [step]);

  const handlePay = async () => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 9) {
      Alert.alert('Invalid Number', 'Please enter your MTN or Orange mobile money number.');
      return;
    }
    setLoading(true);
    try {
      const result = await initiatePremiumPayment(selectedPlan, clean);
      setPaymentRef(result.reference);
      setPollCount(0);
      setStep('pending');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error ?? 'Could not initiate payment. Try again.');
    } finally {
      setLoading(false);
    }
  };

  function fmtDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // ── SUCCESS ─────────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1a2e4a" />
        </TouchableOpacity>
        <View style={styles.centerBox}>
          <View style={styles.successIcon}>
            <Ionicons name="star" size={40} color="#d97706" />
          </View>
          <Text style={styles.successTitle}>Premium Active!</Text>
          {expiresAt && (
            <Text style={styles.successSub}>Your subscription renews on {fmtDate(expiresAt)}</Text>
          )}
          <View style={styles.featureList}>
            {FEATURES.map(f => (
              <View key={f} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('SubShops')}>
            <Text style={styles.primaryBtnText}>Manage Branches →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── PENDING ──────────────────────────────────────────────────────────────────
  if (step === 'pending') {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1a2e4a" />
        </TouchableOpacity>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#d97706" />
          <Text style={styles.pendingTitle}>Waiting for payment…</Text>
          <Text style={styles.pendingSub}>
            A payment request has been sent to your phone.{'\n'}
            Open your mobile money app and approve the request.
          </Text>
          <View style={styles.infoBox}>
            <Ionicons name="phone-portrait-outline" size={18} color="#1a2e4a" />
            <Text style={styles.infoBoxText}>
              Amount: <Text style={{ fontWeight: '700' }}>
                {selectedPlan === 'monthly' ? '9,000' : '108,000'} XAF
              </Text>
            </Text>
          </View>
          <Text style={styles.pollHint}>Checking status… ({pollCount} checks)</Text>
          <TouchableOpacity style={styles.cancelLink} onPress={() => { clearInterval(pollRef.current); setStep('select'); }}>
            <Text style={styles.cancelLinkText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── FAILED ───────────────────────────────────────────────────────────────────
  if (step === 'failed') {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1a2e4a" />
        </TouchableOpacity>
        <View style={styles.centerBox}>
          <View style={styles.failIcon}>
            <Ionicons name="close-circle" size={48} color="#dc2626" />
          </View>
          <Text style={styles.failTitle}>Payment Failed</Text>
          <Text style={styles.failSub}>The payment was declined or timed out. Please try again.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep('select')}>
            <Text style={styles.primaryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── SELECT PLAN ──────────────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={22} color="#1a2e4a" />
      </TouchableOpacity>

      <View style={styles.heroRow}>
        <Ionicons name="star" size={26} color="#d97706" />
        <Text style={styles.heroTitle}>ShopMaster Premium</Text>
      </View>
      <Text style={styles.heroSub}>Unlock multi-branch management for your business</Text>

      <View style={styles.featureCard}>
        {FEATURES.map(f => (
          <View key={f} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={16} color="#059669" />
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Choose a Plan</Text>
      {PLANS.map(plan => (
        <TouchableOpacity
          key={plan.key}
          style={[styles.planCard, selectedPlan === plan.key && styles.planCardSelected]}
          onPress={() => setSelectedPlan(plan.key)}
          activeOpacity={0.8}
        >
          <View style={styles.planLeft}>
            <View style={[styles.radio, selectedPlan === plan.key && styles.radioSelected]}>
              {selectedPlan === plan.key && <View style={styles.radioDot} />}
            </View>
            <View>
              <Text style={[styles.planLabel, selectedPlan === plan.key && styles.planLabelSelected]}>
                {plan.label}
              </Text>
              <Text style={styles.planSub}>{plan.sub}</Text>
            </View>
          </View>
          <View style={styles.planRight}>
            {plan.saving && (
              <View style={styles.savingBadge}>
                <Text style={styles.savingText}>{plan.saving}</Text>
              </View>
            )}
            <Text style={[styles.planPrice, selectedPlan === plan.key && styles.planPriceSelected]}>
              {plan.price}
            </Text>
          </View>
        </TouchableOpacity>
      ))}

      <Text style={styles.sectionLabel}>Mobile Money Number</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 677123456 (MTN or Orange)"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        maxLength={15}
      />
      <Text style={styles.hint}>We'll send a payment request to this number via MTN MoMo or Orange Money.</Text>

      <TouchableOpacity
        style={[styles.payBtn, loading && styles.payBtnDisabled]}
        onPress={handlePay}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <>
              <Ionicons name="lock-closed" size={18} color="#fff" />
              <Text style={styles.payBtnText}>
                Pay {selectedPlan === 'monthly' ? '9,000' : '108,000'} XAF
              </Text>
            </>
        }
      </TouchableOpacity>
      <Text style={styles.secureNote}>Payments are processed securely via Campay</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 24, paddingTop: 56, paddingBottom: 48 },
  backBtn: { padding: 4, marginBottom: 20 },

  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#1a2e4a' },
  heroSub: { fontSize: 14, color: '#6b7280', marginBottom: 20, lineHeight: 20 },

  featureCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 24, gap: 10 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { fontSize: 14, color: '#374151' },

  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },

  planCard: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 2, borderColor: '#e5e7eb',
    padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  planCardSelected: { borderColor: '#d97706', backgroundColor: '#fffbeb' },
  planLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planRight: { alignItems: 'flex-end', gap: 4 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#d1d5db', justifyContent: 'center', alignItems: 'center' },
  radioSelected: { borderColor: '#d97706' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#d97706' },
  planLabel: { fontSize: 15, fontWeight: '700', color: '#374151' },
  planLabelSelected: { color: '#92400e' },
  planSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  planPrice: { fontSize: 16, fontWeight: '800', color: '#374151' },
  planPriceSelected: { color: '#d97706' },
  savingBadge: { backgroundColor: '#d97706', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  savingText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 8,
  },
  hint: { fontSize: 12, color: '#9ca3af', marginBottom: 24, lineHeight: 18 },

  payBtn: {
    backgroundColor: '#1a2e4a', borderRadius: 12, paddingVertical: 16,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 10,
  },
  payBtnDisabled: { opacity: 0.6 },
  payBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secureNote: { textAlign: 'center', fontSize: 12, color: '#9ca3af' },

  // Center states
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, paddingTop: 80 },
  successIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fef3c7', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: '800', color: '#1a2e4a', marginBottom: 6 },
  successSub: { fontSize: 14, color: '#6b7280', marginBottom: 24, textAlign: 'center' },
  failIcon: { marginBottom: 16 },
  failTitle: { fontSize: 22, fontWeight: '800', color: '#dc2626', marginBottom: 8 },
  failSub: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 28, lineHeight: 20 },
  pendingTitle: { fontSize: 20, fontWeight: '800', color: '#1a2e4a', marginTop: 20, marginBottom: 10 },
  pendingSub: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#eff6ff', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16 },
  infoBoxText: { fontSize: 14, color: '#1a2e4a' },
  pollHint: { fontSize: 12, color: '#9ca3af', marginBottom: 20 },
  cancelLink: { padding: 10 },
  cancelLinkText: { color: '#dc2626', fontWeight: '600', fontSize: 14 },
  primaryBtn: { backgroundColor: '#1a2e4a', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, marginTop: 8 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
