import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Switch, ActivityIndicator, Clipboard, ToastAndroid, Platform, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import { useShop } from '../../context/ShopContext';
import { getSettings, updateSettings, getPremiumStatus, activateLicense } from '../../services/api';

const CURRENCIES = [
  { code: 'XAF', name: 'CFA Franc (CEMAC)' },
  { code: 'XOF', name: 'CFA Franc (UEMOA)' },
  { code: 'NGN', name: 'Nigerian Naira' },
  { code: 'GHS', name: 'Ghanaian Cedi' },
  { code: 'KES', name: 'Kenyan Shilling' },
  { code: 'TZS', name: 'Tanzanian Shilling' },
  { code: 'UGX', name: 'Ugandan Shilling' },
  { code: 'ZAR', name: 'South African Rand' },
  { code: 'EGP', name: 'Egyptian Pound' },
  { code: 'MAD', name: 'Moroccan Dirham' },
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'BRL', name: 'Brazilian Real' },
  { code: 'JPY', name: 'Japanese Yen' },
];

function previewFmt(code) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: code, minimumFractionDigits: 0 }).format(12500);
  } catch { return `${code} 12,500`; }
}

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const { user, logout, licenseStatus, refreshLicense } = useAuth();
  const { reloadSettings } = useShop();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [isSubShop, setIsSubShop] = useState(false);
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState(null);
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [licenseActivating, setLicenseActivating] = useState(false);

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
    Promise.all([getSettings(), getPremiumStatus()])
      .then(([d, p]) => {
        setName(d.name ?? '');
        setAddress(d.address ?? '');
        setPhone(d.phone ?? '');
        setEmail(d.email ?? '');
        setTaxEnabled(Boolean(d.tax_enabled));
        setTaxRate(String(d.tax_rate ?? 0));
        setTaxLabel(d.tax_label ?? 'VAT');
        setCurrency(d.currency ?? 'XAF');
        setReceiptFooter(d.receipt_footer ?? '');
        setIsPremium(Boolean(p.isPremium));
        setIsSubShop(Boolean(p.isSubShop));
        setSubscriptionExpiresAt(p.subscriptionExpiresAt ?? null);
      })
      .catch(() => setError(t('settings.loadFailed')))
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
      await reloadSettings();
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.error ?? t('settings.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a2e4a" />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>{t('settings.title')}</Text>

      <Section title={t('settings.sections.account')}>
        <InfoRow label={t('settings.fields.shopId')} value={user?.shopId} />
      </Section>

      <Section title={t('settings.sections.shopProfile')}>
        <Field label={t('settings.fields.shopName')} value={name} onChangeText={setName} />
        <Field label={t('settings.fields.address')} value={address} onChangeText={setAddress} />
        <Field label={t('settings.fields.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Field label={t('settings.fields.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      </Section>

      <Section title={t('settings.sections.tax')}>
        <View style={styles.switchRow}>
          <Text style={styles.label}>{t('settings.fields.enableTax')}</Text>
          <Switch
            value={taxEnabled}
            onValueChange={setTaxEnabled}
            trackColor={{ false: '#d1d5db', true: '#1a2e4a' }}
            thumbColor="#fff"
            accessibilityLabel="Enable tax"
          />
        </View>
        {taxEnabled && (
          <>
            <Field label={t('settings.fields.taxRate')} value={taxRate} onChangeText={setTaxRate} keyboardType="decimal-pad" />
            <Field label={t('settings.fields.taxLabel')} value={taxLabel} onChangeText={setTaxLabel} placeholder={t('settings.fields.taxLabelPlaceholder')} />
          </>
        )}
      </Section>

      <Section title={t('settings.sections.currency')}>
        <Text style={styles.label}>{t('settings.fields.currencySymbol')}</Text>
        <View style={styles.currencyGrid} accessibilityRole="radiogroup">
          {CURRENCIES.map(c => (
            <TouchableOpacity
              key={c.code}
              style={[styles.currencyChip, currency === c.code && styles.currencyChipActive]}
              onPress={() => setCurrency(c.code)}
              accessibilityRole="radio"
              accessibilityState={{ selected: currency === c.code }}
              accessibilityLabel={`${c.code} — ${c.name}`}
            >
              <Text style={[styles.currencyChipCode, currency === c.code && styles.currencyChipCodeActive]}>{c.code}</Text>
              <Text style={[styles.currencyChipName, currency === c.code && styles.currencyChipNameActive]} numberOfLines={1}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.currencyPreview}>{previewFmt(currency)}</Text>
      </Section>

      <Section title={t('settings.sections.receipt')}>
        <Field
          label={t('settings.fields.receiptFooter')}
          value={receiptFooter}
          onChangeText={setReceiptFooter}
          placeholder={t('settings.fields.receiptFooterPlaceholder')}
          multiline
          numberOfLines={3}
        />
      </Section>

      {/* Language switcher */}
      <Section title={t('settings.sections.language')}>
        <Text style={styles.label}>{t('settings.language.label')}</Text>
        <View style={styles.langRow} accessibilityRole="radiogroup">
          {['en', 'fr'].map(lang => (
            <TouchableOpacity
              key={lang}
              style={[styles.langBtn, i18n.language === lang && styles.langBtnActive]}
              onPress={() => changeLanguage(lang)}
              accessibilityRole="radio"
              accessibilityState={{ selected: i18n.language === lang }}
              accessibilityLabel={lang === 'en' ? 'English' : 'Français'}
            >
              <Text style={[styles.langBtnText, i18n.language === lang && styles.langBtnTextActive]}>
                {lang === 'en' ? '🇬🇧 English' : '🇫🇷 Français'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Section>

      {user?.role === 'admin' && (
        <TouchableOpacity
          style={styles.staffBtn}
          onPress={() => navigation.navigate('UserManagement')}
          accessibilityRole="button"
          accessibilityLabel="Manage staff"
        >
          <Text style={styles.staffBtnText}>{t('settings.manageStaff')}</Text>
        </TouchableOpacity>
      )}

      {user?.role === 'admin' && !isSubShop && (
        <LicenseSection
          licenseStatus={licenseStatus}
          licenseKeyInput={licenseKeyInput}
          setLicenseKeyInput={setLicenseKeyInput}
          licenseActivating={licenseActivating}
          onActivate={async () => {
            const trimmed = licenseKeyInput.trim();
            if (!trimmed) return;
            setLicenseActivating(true);
            try {
              await activateLicense(trimmed);
              await refreshLicense();
              setLicenseKeyInput('');
              Alert.alert('License Activated', 'Your license is now active. Multi-branch management is unlocked.');
            } catch (err) {
              Alert.alert('Activation Failed', err.response?.data?.error ?? 'Invalid or already-used key.');
            } finally {
              setLicenseActivating(false);
            }
          }}
          onNavigateBranches={() => navigation.navigate('SubShops')}
        />
      )}

      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={() => Alert.alert(
          t('settings.logoutTitle'),
          t('settings.logoutConfirm'),
          [{ text: t('common.cancel'), style: 'cancel' }, { text: t('settings.logout'), style: 'destructive', onPress: logout }]
        )}
        accessibilityRole="button"
        accessibilityLabel="Log out"
      >
        <Text style={styles.logoutBtnText}>{t('settings.logout')}</Text>
      </TouchableOpacity>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {saved ? <Text style={styles.savedText}>{t('settings.saved')}</Text> : null}

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
        accessibilityRole="button"
        accessibilityLabel={saving ? 'Saving settings' : 'Save settings'}
        accessibilityState={{ disabled: saving }}
      >
        <Text style={styles.saveBtnText}>{saving ? t('settings.saving') : t('settings.saveSettings')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function LicenseSection({ licenseStatus, licenseKeyInput, setLicenseKeyInput, licenseActivating, onActivate, onNavigateBranches }) {
  const isLicensed = licenseStatus?.isLicensed;
  const trialDaysRemaining = licenseStatus?.trialDaysRemaining ?? 0;
  const trialExpired = licenseStatus?.trialExpired;

  if (isLicensed) {
    const isPro = licenseStatus?.licenseType === 'pro';
    const expiresAt = licenseStatus?.licenseExpiresAt;
    const expiryStr = expiresAt
      ? new Date(expiresAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
      : null;
    return (
      <>
        <View style={styles.licenseActiveCard}>
          <View style={styles.licenseHeader}>
            <Ionicons name="shield-checkmark" size={18} color="#059669" />
            <Text style={styles.licenseActiveTitle}>
              {isPro ? 'Pro License — Active' : 'Basic License — Active'}
            </Text>
          </View>
          <Text style={styles.licenseActiveSub}>
            {isPro ? 'Full access · Multi-branch enabled' : 'Main shop access only'}
          </Text>
          {expiryStr && (
            <Text style={styles.licenseExpiry}>Expires {expiryStr}</Text>
          )}
        </View>
        {isPro && (
          <TouchableOpacity
            style={styles.branchesBtn}
            onPress={onNavigateBranches}
            accessibilityRole="button"
            accessibilityLabel="Manage branches"
          >
            <View style={styles.branchesBtnLeft} importantForAccessibility="no">
              <Ionicons name="storefront-outline" size={20} color="#1a2e4a" importantForAccessibility="no" />
              <Text style={styles.branchesBtnText}>Manage Branches</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#1a2e4a" importantForAccessibility="no" />
          </TouchableOpacity>
        )}
      </>
    );
  }

  return (
    <View style={[styles.licenseCard, trialExpired && styles.licenseCardExpired]}>
      <View style={styles.licenseHeader}>
        <Ionicons name={trialExpired ? 'lock-closed' : 'time-outline'} size={18} color={trialExpired ? '#dc2626' : '#d97706'} />
        <Text style={[styles.licenseTitle, trialExpired && styles.licenseTitleExpired]}>
          {trialExpired ? 'Trial Expired' : `Free Trial — ${trialDaysRemaining} day${trialDaysRemaining !== 1 ? 's' : ''} remaining`}
        </Text>
      </View>
      <Text style={styles.licenseDesc}>
        {trialExpired
          ? 'Your trial has ended. Enter a license key to restore access.'
          : 'Multi-branch management requires a license key. Enter one below to unlock it.'}
      </Text>
      <TextInput
        style={styles.licenseInput}
        value={licenseKeyInput}
        onChangeText={setLicenseKeyInput}
        placeholder="SMPR-XXXXXXXX-XXXXXXXX-XXXXXXXX"
        placeholderTextColor="#9ca3af"
        autoCapitalize="characters"
        autoCorrect={false}
        accessibilityLabel="License key input"
      />
      <TouchableOpacity
        style={[styles.licenseBtn, licenseActivating && { opacity: 0.6 }]}
        onPress={onActivate}
        disabled={licenseActivating}
        accessibilityRole="button"
        accessibilityLabel="Activate license key"
      >
        {licenseActivating
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.licenseBtnText}>Activate License Key</Text>}
      </TouchableOpacity>
    </View>
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
  const { t } = useTranslation();
  const copy = () => {
    Clipboard.setString(value);
    if (Platform.OS === 'android') {
      ToastAndroid.show(t('common.ok'), ToastAndroid.SHORT);
    } else {
      Alert.alert(t('common.ok'), 'Shop ID copied to clipboard.');
    }
  };
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.infoRow}
        onPress={copy}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Copy shop ID to clipboard"
      >
        <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="middle">{value}</Text>
        <Text style={styles.copyHint}>{t('common.ok')}</Text>
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
  branchesBtn: { backgroundColor: '#eff6ff', borderRadius: 10, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  branchesBtnLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  branchesBtnText: { color: '#1a2e4a', fontWeight: '700', fontSize: 15 },
  premiumCard: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 12, padding: 16, marginBottom: 12, gap: 10 },
  premiumActiveCard: { backgroundColor: '#fef3c7', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#fde68a' },
  premiumHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  premiumTitle: { fontSize: 15, fontWeight: '800', color: '#92400e' },
  premiumActiveTitle: { fontSize: 14, fontWeight: '700', color: '#92400e' },
  premiumExpiry: { fontSize: 12, color: '#b45309', marginTop: 4 },
  premiumDesc: { fontSize: 13, color: '#78350f', lineHeight: 19 },
  premiumPricing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  premiumPrice: { fontSize: 14, fontWeight: '700', color: '#92400e' },
  premiumPricePer: { fontWeight: '400', fontSize: 12 },
  premiumPriceDivider: { color: '#b45309' },
  upgradeBtn: { backgroundColor: '#d97706', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  upgradeBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  comingSoonBadge: { backgroundColor: '#f3f4f6', borderRadius: 8, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  comingSoonText: { color: '#9ca3af', fontWeight: '700', fontSize: 13, letterSpacing: 0.5 },
  logoutBtn: { borderWidth: 1, borderColor: '#dc2626', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8, marginBottom: 4 },
  logoutBtnText: { color: '#dc2626', fontWeight: '700', fontSize: 15 },
  errorText: { color: '#dc2626', fontSize: 13, marginBottom: 8, textAlign: 'center' },
  savedText: { color: '#059669', fontSize: 13, marginBottom: 8, textAlign: 'center' },
  saveBtn: { backgroundColor: '#1a2e4a', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  currencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  currencyChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#f9fafb',
  },
  currencyChipActive: { borderColor: '#1a56db', backgroundColor: '#eff6ff' },
  currencyChipCode: { fontSize: 13, fontWeight: '800', color: '#374151' },
  currencyChipCodeActive: { color: '#1a56db' },
  currencyChipName: { fontSize: 10, color: '#9ca3af', maxWidth: 90 },
  currencyChipNameActive: { color: '#6b7280' },
  currencyPreview: { fontSize: 12, color: '#6b7280', marginTop: 6, fontStyle: 'italic' },
  langRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  langBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#f9fafb',
  },
  langBtnActive: { borderColor: '#1a56db', backgroundColor: '#eff6ff' },
  langBtnText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  langBtnTextActive: { color: '#1a56db' },

  // License section
  licenseCard: {
    backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a',
    borderRadius: 12, padding: 16, marginBottom: 12, gap: 10,
  },
  licenseCardExpired: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  licenseHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  licenseTitle: { fontSize: 15, fontWeight: '800', color: '#92400e' },
  licenseTitleExpired: { color: '#dc2626' },
  licenseDesc: { fontSize: 13, color: '#78350f', lineHeight: 19 },
  licenseInput: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#d1d5db',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, color: '#111827', letterSpacing: 0.8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  licenseBtn: {
    backgroundColor: '#1a2e4a', borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  licenseBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  licenseActiveCard: {
    backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0',
    borderRadius: 10, padding: 12, marginBottom: 8,
  },
  licenseActiveTitle: { fontSize: 14, fontWeight: '700', color: '#059669' },
  licenseActiveSub: { fontSize: 12, color: '#065f46', marginTop: 3 },
  licenseExpiry: { fontSize: 11, color: '#6b7280', marginTop: 4 },
});
