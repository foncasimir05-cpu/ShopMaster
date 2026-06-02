import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const ACTIONS = [
  { label: 'New Sale',     icon: 'cart',    screen: 'POS' },
  { label: 'Add Product',  icon: 'cube',    screen: 'Products' },
  { label: 'View Reports', icon: 'receipt', screen: 'SalesHistory' },
];

export default function HomeScreen() {
  const { logout, user } = useAuth();
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back, {user?.email}</Text>
          <Text style={styles.heading}>ShopMaster Dashboard</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionLabel}>Quick Actions</Text>
      <View style={styles.actionsRow}>
        {ACTIONS.map(action => (
          <TouchableOpacity
            key={action.screen}
            style={styles.actionCard}
            onPress={() => navigation.navigate(action.screen)}
          >
            <Ionicons name={action.icon} size={28} color="#fff" />
            <Text style={styles.actionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 24, paddingTop: 60 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  greeting: { fontSize: 13, color: '#6b7280' },
  heading: { fontSize: 22, fontWeight: 'bold', color: '#111827', marginTop: 2 },
  logoutBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutText: { color: '#dc2626', fontWeight: '600', fontSize: 14 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  actionsRow: { flexDirection: 'row', gap: 12 },
  actionCard: {
    backgroundColor: '#1a2e4a',
    borderRadius: 12,
    width: 105,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 10,
  },
  actionLabel: { color: '#fff', fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
