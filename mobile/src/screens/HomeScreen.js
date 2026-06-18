import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useStockAlert } from '../context/StockAlertContext';
import { useOffline } from '../context/OfflineContext';
import { F } from '../theme';

function timeAgo(iso) {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const ACTION_DEFS = [
  { key: 'newSale',    icon: 'cart',           screen: 'POS',            color: '#2563eb', bg: '#eff6ff' },
  { key: 'products',   icon: 'cube',            screen: 'Products',        color: '#7c3aed', bg: '#f3e8ff' },
  { key: 'analytics',  icon: 'bar-chart',       screen: 'Analytics',       color: '#059669', bg: '#ecfdf5' },
  { key: 'customers',  icon: 'people',          screen: 'Customers',       color: '#d97706', bg: '#fffbeb' },
  { key: 'sales',      icon: 'receipt',         screen: 'SalesHistory',    color: '#0891b2', bg: '#ecfeff' },
  { key: 'closeDay',   icon: 'lock-closed',     screen: 'CloseOfDay',      color: '#64748b', bg: '#f1f5f9' },
  { key: 'suppliers',  icon: 'business',        screen: 'Suppliers',       color: '#0d9488', bg: '#f0fdfa' },
  { key: 'purchases',  icon: 'clipboard',       screen: 'PurchaseOrders',  color: '#ea580c', bg: '#fff7ed' },
  { key: 'promotions', icon: 'pricetag',        screen: 'Promotions',      color: '#db2777', bg: '#fdf2f8' },
  { key: 'expenses',   icon: 'wallet',          screen: 'Expenses',        color: '#dc2626', bg: '#fef2f2' },
];

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const { logout, user } = useAuth();
  const navigation = useNavigation();
  const { count: lowStockCount, products: lowStockProducts } = useStockAlert();
  const { isOnline, pendingCount, lastSyncedAt, manualSync } = useOffline();
  const [syncing, setSyncing] = useState(false);

  const handleManualSync = useCallback(async () => {
    setSyncing(true);
    try { await manualSync(); } finally { setSyncing(false); }
  }, [manualSync]);

  const now = new Date();
  const dateStr = now.toLocaleDateString(i18n.language, { weekday: 'long', month: 'long', day: 'numeric' });
  const userName = user?.name ?? user?.email?.split('@')[0];

  const lowStockNames = lowStockProducts.slice(0, 3).map(p => p.name).join(', ')
    + (lowStockCount > 3 ? ` and ${lowStockCount - 3} more` : '');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* Hero header card */}
      <View
        style={styles.hero}
        accessible
        accessibilityLabel={`${dateStr}. Welcome back, ${userName}. Shop: ${user?.shopName ?? 'ShopMaster'}`}
      >
        <View style={styles.heroTop} importantForAccessibility="no">
          <View style={styles.heroDot} />
          <View style={styles.heroDot2} />
          <View style={styles.heroDot3} />
        </View>
        <Text style={styles.heroDate} importantForAccessibility="no">{dateStr}</Text>
        <Text style={styles.heroGreeting} importantForAccessibility="no">
          {t('home.welcomeBack')}{'\n'}
          <Text style={styles.heroName}>{userName}</Text>
        </Text>
        <View style={styles.heroFooter}>
          <View style={styles.heroShop} importantForAccessibility="no">
            <Ionicons name="storefront-outline" size={12} color="#93c5fd" importantForAccessibility="no" />
            <Text style={styles.heroShopName} numberOfLines={1}>{user?.shopName ?? 'ShopMaster'}</Text>
          </View>
          <TouchableOpacity
            onPress={logout}
            style={styles.logoutBtn}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            <Ionicons name="log-out-outline" size={14} color="#fca5a5" importantForAccessibility="no" />
            <Text style={styles.logoutText}>{t('home.logout')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sync status bar */}
      <View
        style={styles.syncRow}
        accessible
        accessibilityLabel={isOnline
          ? `Online. ${pendingCount > 0 ? pendingCount + ' operations queued.' : 'All synced.'} ${lastSyncedAt ? 'Last synced ' + timeAgo(lastSyncedAt) + '.' : ''}`
          : `Offline. ${pendingCount > 0 ? pendingCount + ' operations queued.' : ''}`}
      >
        <View style={[styles.syncDot, { backgroundColor: isOnline ? '#10b981' : '#ef4444' }]} importantForAccessibility="no" />
        <Text style={styles.syncText} importantForAccessibility="no">
          {isOnline
            ? (lastSyncedAt ? `Synced ${timeAgo(lastSyncedAt)}` : 'Connected')
            : 'Offline'}
        </Text>
        {pendingCount > 0 && (
          <View style={styles.pendingBadge} importantForAccessibility="no">
            <Text style={styles.pendingBadgeText}>{pendingCount} queued</Text>
          </View>
        )}
        {isOnline && (
          <TouchableOpacity
            onPress={handleManualSync}
            disabled={syncing}
            style={styles.syncBtn}
            accessibilityRole="button"
            accessibilityLabel="Sync now"
          >
            {syncing
              ? <ActivityIndicator size="small" color="#2563eb" style={{ width: 14, height: 14 }} />
              : <Ionicons name="sync-outline" size={13} color="#2563eb" importantForAccessibility="no" />}
            <Text style={styles.syncBtnText}>{syncing ? 'Syncing…' : 'Sync'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Low stock alert */}
      {lowStockCount > 0 && (
        <TouchableOpacity
          style={styles.alertCard}
          onPress={() => navigation.navigate('Products')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Low stock alert: ${lowStockCount} product${lowStockCount !== 1 ? 's' : ''} need restocking. ${lowStockNames}. Tap to view products.`}
        >
          <View style={styles.alertIconWrap} importantForAccessibility="no">
            <Ionicons name="warning" size={18} color="#d97706" />
          </View>
          <View style={{ flex: 1 }} importantForAccessibility="no">
            <Text style={styles.alertTitle}>
              {t('home.lowStock', { count: lowStockCount })}
            </Text>
            <Text style={styles.alertSub} numberOfLines={1}>
              {lowStockProducts.slice(0, 3).map(p => p.name).join(', ')}
              {lowStockCount > 3 ? ` +${lowStockCount - 3} more` : ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#d97706" importantForAccessibility="no" />
        </TouchableOpacity>
      )}

      <Text style={styles.sectionLabel}>{t('home.quickActions')}</Text>

      <View style={styles.actionsGrid}>
        {ACTION_DEFS.map(action => {
          const isPrimary = action.key === 'newSale';
          return (
            <TouchableOpacity
              key={action.screen}
              style={[styles.actionCard, isPrimary && styles.actionCardPrimary]}
              onPress={() => navigation.navigate(action.screen)}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityLabel={t(`home.actions.${action.key}`)}
            >
              <View
                style={[
                  styles.actionIconWrap,
                  { backgroundColor: isPrimary ? 'rgba(255,255,255,0.2)' : action.bg },
                ]}
                importantForAccessibility="no"
              >
                <Ionicons name={action.icon} size={22} color={isPrimary ? '#fff' : action.color} />
              </View>
              <Text
                style={[styles.actionLabel, isPrimary && styles.actionLabelPrimary]}
                importantForAccessibility="no"
              >
                {t(`home.actions.${action.key}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 16, paddingTop: 56, paddingBottom: 40 },

  // Hero card
  hero: {
    backgroundColor: '#1a2e4a',
    borderRadius: 20, padding: 20,
    marginBottom: 16, overflow: 'hidden',
    shadowColor: '#1a2e4a', shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  heroTop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  heroDot: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.04)', top: -30, right: -20,
  },
  heroDot2: {
    position: 'absolute', width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.05)', bottom: 10, right: 60,
  },
  heroDot3: {
    position: 'absolute', width: 50, height: 50, borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.04)', top: 20, right: 100,
  },
  heroDate: { fontSize: 12, fontFamily: F.semiBold, color: '#93c5fd', marginBottom: 8, letterSpacing: 0.3 },
  heroGreeting: { fontSize: 15, fontFamily: F.regular, color: 'rgba(255,255,255,0.7)', lineHeight: 24, marginBottom: 16 },
  heroName: { fontSize: 24, fontFamily: F.black, color: '#fff' },
  heroFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroShop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroShopName: { fontSize: 12, fontFamily: F.semiBold, color: '#93c5fd' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, backgroundColor: 'rgba(220,38,38,0.15)' },
  logoutText: { color: '#fca5a5', fontSize: 12, fontFamily: F.bold },

  // Alert card
  alertCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fffbeb', borderWidth: 1.5, borderColor: '#fde68a',
    borderRadius: 14, padding: 14, marginBottom: 20,
  },
  alertIconWrap: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#fef3c7', justifyContent: 'center', alignItems: 'center',
  },
  alertTitle: { fontSize: 13, fontFamily: F.bold, color: '#92400e' },
  alertSub: { fontSize: 11.5, color: '#b45309', marginTop: 2 },

  syncRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9,
    marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb',
  },
  syncDot: { width: 7, height: 7, borderRadius: 4 },
  syncText: { flex: 1, fontSize: 12, fontFamily: F.semiBold, color: '#6b7280' },
  pendingBadge: {
    backgroundColor: '#fef3c7', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  pendingBadgeText: { fontSize: 11, fontFamily: F.bold, color: '#92400e' },
  syncBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#eff6ff', borderRadius: 8,
    paddingHorizontal: 9, paddingVertical: 5,
  },
  syncBtnText: { fontSize: 11, fontFamily: F.bold, color: '#2563eb' },

  sectionLabel: {
    fontSize: 11, fontFamily: F.bold, color: '#94a3b8',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12,
  },

  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard: {
    width: '30%', backgroundColor: '#fff',
    borderRadius: 16, paddingVertical: 16, paddingHorizontal: 8,
    alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    borderWidth: 1, borderColor: '#f1f5f9',
  },
  actionCardPrimary: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
    shadowColor: '#2563eb', shadowOpacity: 0.25, shadowRadius: 10, elevation: 5,
  },
  actionIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  actionLabel: {
    color: '#374151', fontSize: 11.5, fontFamily: F.bold,
    textAlign: 'center', lineHeight: 15,
  },
  actionLabelPrimary: { color: '#fff' },
});
