import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useStockAlert } from '../context/StockAlertContext';

const ACTIONS = [
  { label: 'New Sale',     icon: 'cart',           screen: 'POS' },
  { label: 'Add Product',  icon: 'cube',           screen: 'Products' },
  { label: 'View Reports', icon: 'receipt',        screen: 'SalesHistory' },
  { label: 'Close Day',    icon: 'lock-closed',    screen: 'CloseOfDay' },
];

export default function HomeScreen() {
  const { logout, user } = useAuth();
  const navigation = useNavigation();
  const { count: lowStockCount, products: lowStockProducts } = useStockAlert();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back, {user?.name ?? user?.email}</Text>
          <Text style={styles.heading}>ShopMaster Dashboard</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Low stock alert */}
      {lowStockCount > 0 && (
        <TouchableOpacity
          style={styles.alertCard}
          onPress={() => navigation.navigate('Products')}
          activeOpacity={0.8}
        >
          <View style={styles.alertIcon}>
            <Ionicons name="warning" size={20} color="#d97706" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.alertTitle}>
              {lowStockCount} product{lowStockCount > 1 ? 's' : ''} running low
            </Text>
            <Text style={styles.alertSub} numberOfLines={1}>
              {lowStockProducts.slice(0, 3).map(p => p.name).join(', ')}
              {lowStockCount > 3 ? ` +${lowStockCount - 3} more` : ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#d97706" />
        </TouchableOpacity>
      )}

      <Text style={styles.sectionLabel}>Quick Actions</Text>
      <View style={styles.actionsRow}>
        {ACTIONS.map(action => (
          <TouchableOpacity
            key={action.screen}
            style={styles.actionCard}
            onPress={() => navigation.navigate(action.screen)}
          >
            <Ionicons name={action.icon} size={26} color="#fff" />
            <Text style={styles.actionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 24, paddingTop: 60, paddingBottom: 40 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  greeting: { fontSize: 13, color: '#6b7280' },
  heading: { fontSize: 22, fontWeight: 'bold', color: '#111827', marginTop: 2 },
  logoutBtn: { backgroundColor: '#fee2e2', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  logoutText: { color: '#dc2626', fontWeight: '600', fontSize: 14 },
  alertCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a',
    borderRadius: 10, padding: 12, marginBottom: 20,
  },
  alertIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fef3c7', justifyContent: 'center', alignItems: 'center' },
  alertTitle: { fontSize: 14, fontWeight: '700', color: '#92400e' },
  alertSub: { fontSize: 12, color: '#b45309', marginTop: 2 },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', color: '#6b7280',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12,
  },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: {
    backgroundColor: '#1a2e4a', borderRadius: 12,
    width: 105, paddingVertical: 20, alignItems: 'center', gap: 10,
  },
  actionLabel: { color: '#fff', fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
