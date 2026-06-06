import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Switch, ActivityIndicator, Clipboard, ToastAndroid, Platform, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { getSettings, updateSettings } from '../../services/api';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState('0');
  const [taxLabel, setTaxLabel] = useState('VAT');
  const [currency, setCurrency] = useState('XAF');
  const [receiptFooter, setReceiptFooter] = useState('');

  useEffect(() => {
    getSettings()
      .then(d => {
        setName(d.name ?? '');
        setAddress(d.address ?? '');
        setPhone(d.phone ?? '');
        setEmail(d.email ?? '');
        setTaxEnabled(Boolean(d.tax_enabled));
        setTaxRate(String(d.tax_rate ?? 0));
        setTaxLabel(d.tax_label ?? 'VAT');
        setCurrency(d.currency ?? 'XAF');
        setReceiptFooter(d.receipt_footer ?? '');
      })
      .catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await updateSettings({
        name, address, phone, email,
        tax_enabled: taxEnabled,
        tax_rate: parseFloat(taxRate) || 0,
        tax_label: taxLabel,
        currency,
        receipt_footer: receiptFooter,
      });
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a2e4a" />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Settings</Text>

      <Section title="Account">
        <InfoRow label="Shop ID" value={user?.shopId} />
      </Section>

      <Section title="Shop Profile">
        <Field label="Shop Name" value={name} onChangeText={setName} />
        <Field label="Address" value={address} onChangeText={setAddress} />
        <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      </Section>

      <Section title="Tax">
        <View style={styles.switchRow}>
          <Text style={styles.label}>Enable Tax</Text>
          <Switch
            value={taxEnabled}
            onValueChange={setTaxEnabled}
            trackColor={{ false: '#d1d5db', true: '#1a2e4a' }}
            thumbColor="#fff"
          />
        </View>
        {taxEnabled && (
          <>
            <Field label="Tax Rate (%)" value={taxRate} onChangeText={setTaxRate} keyboardType="decimal-pad" />
            <Field label="Tax Label" value={taxLabel} onChangeText={setTaxLabel} placeholder="e.g. VAT, GST" />
          </>
        )}
      </Section>

      <Section title="Currency">
        <Field label="Currency Symbol" value={currency} onChangeText={setCurrency} placeholder="e.g. XAF, USD, €" />
      </Section>

      <Section title="Receipt">
        <Field
          label="Footer Message"
          value={receiptFooter}
          onChangeText={setReceiptFooter}
          placeholder="Thank you for your business!"
          multiline
          numberOfLines={3}
        />
      </Section>

      {user?.role === 'admin' && (
        <TouchableOpacity style={styles.staffBtn} onPress={() => navigation.navigate('UserManagement')}>
          <Text style={styles.staffBtnText}>Manage Staff →</Text>
        </TouchableOpacity>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {saved ? <Text style={styles.savedText}>Settings saved.</Text> : null}

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Settings'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function InfoRow({ label, value }) {
  const copy = () => {
    Clipboard.setString(value);
    if (Platform.OS === 'android') {
      ToastAndroid.show('Copied to clipboard', ToastAndroid.SHORT);
    } else {
      Alert.alert('Copied', 'Shop ID copied to clipboard.');
    }
  };
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.infoRow} onPress={copy} activeOpacity={0.7}>
        <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="middle">{value}</Text>
        <Text style={styles.copyHint}>Copy</Text>
      </TouchableOpacity>
    </View>
  );
}

function Field({ label, ...props }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={[styles.input, props.multiline && { height: 72, textAlignVertical: 'top' }]} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 24, paddingTop: 60, paddingBottom: 40 },
  heading: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 24 },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, gap: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  fieldWrap: { gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  infoValue: { fontSize: 13, color: '#374151', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', flex: 1, marginRight: 8 },
  copyHint: { fontSize: 12, fontWeight: '700', color: '#1a56db' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  staffBtn: { backgroundColor: '#eff6ff', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 12 },
  staffBtnText: { color: '#1a2e4a', fontWeight: '700', fontSize: 15 },
  errorText: { color: '#dc2626', fontSize: 13, marginBottom: 8, textAlign: 'center' },
  savedText: { color: '#059669', fontSize: 13, marginBottom: 8, textAlign: 'center' },
  saveBtn: { backgroundColor: '#1a2e4a', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
