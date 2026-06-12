import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useStockAlert } from '../context/StockAlertContext';

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

  const now = new Date();
  const dateStr = now.toLocaleDateString(i18n.language, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* Hero header card */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroDot} />
          <View style={styles.heroDot2} />
          <View style={styles.heroDot3} />
        </View>
        <Text style={styles.heroDate}>{dateStr}</Text>
        <Text style={styles.heroGreeting}>
          {t('home.welcomeBack')}{'\n'}
          <Text style={styles.heroName}>{user?.name ?? user?.email?.split('@')[0]}</Text>
        </Text>
        <View style={styles.heroFooter}>
          <View style={styles.heroShop}>
            <Ionicons name="storefront-outline" size={12} color="#93c5fd" />
            <Text style={styles.heroShopName} numberOfLines={1}>{user?.shopName ?? 'ShopMaster'}</Text>
          </View>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={14} color="#fca5a5" />
            <Text style={styles.logoutText}>{t('home.logout')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Low stock alert */}
      {lowStockCount > 0 && (
        <TouchableOpacity
          style={styles.alertCard}
          onPress={() => navigation.navigate('Products')}
          activeOpacity={0.8}
        >
          <View style={styles.alertIconWrap}>
            <Ionicons name="warning" size={18} color="#d97706" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.alertTitle}>
              {t('home.lowStock', { count: lowStockCount })}
            </Text>
            <Text style={styles.alertSub} numberOfLines={1}>
              {lowStockProducts.slice(0, 3).map(p => p.name).join(', ')}
              {lowStockCount > 3 ? ` +${lowStockCount - 3} more` : ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#d97706" />
        </TouchableOpacity>
      )}

      <Text style={styles.sectionLabel}>{t('home.quickActions')}</Text>

      <View style={styles.actionsGrid}>
        {ACTION_DEFS.map(action => (
          <TouchableOpacity
            key={action.screen}
            style={styles.actionCard}
            onPress={() => navigation.navigate(action.screen)}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: action.bg }]}>
              <Ionicons name={action.icon} size={22} color={action.color} />
            </View>
            <Text style={styles.actionLabel}>{t(`home.actions.${action.key}`)}</Text>
          </TouchableOpacity>
        ))}
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
  heroDate: { fontSize: 12, color: '#93c5fd', fontWeight: '600', marginBottom: 8, letterSpacing: 0.3 },
  heroGreeting: { fontSize: 15, color: 'rgba(255,255,255,0.7)', lineHeight: 24, marginBottom: 16 },
  heroName: { fontSize: 22, color: '#fff', fontWeight: '900' },
  heroFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroShop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroShopName: { fontSize: 12, color: '#93c5fd', fontWeight: '600' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, backgroundColor: 'rgba(220,38,38,0.15)' },
  logoutText: { color: '#fca5a5', fontSize: 12, fontWeight: '700' },

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
  alertTitle: { fontSize: 13, fontWeight: '700', color: '#92400e' },
  alertSub: { fontSize: 11.5, color: '#b45309', marginTop: 2 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#94a3b8',
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
  actionIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  actionLabel: {
    color: '#374151', fontSize: 11.5, fontWeight: '700',
    textAlign: 'center', lineHeight: 15,
  },
});
