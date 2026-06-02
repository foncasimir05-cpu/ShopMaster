import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

const TILES = [
  { label: 'Products', screen: 'Products', color: '#1a56db' },
  { label: 'Sales / POS', screen: 'Sales', color: '#0e9f6e' },
  { label: 'Inventory', screen: 'Inventory', color: '#ff5a1f' },
];

export default function HomeScreen() {
  const { logout, user } = useAuth();
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Welcome back{user?.email ? `, ${user.email}` : ''}!</Text>
      <Text style={styles.heading}>ShopMaster Dashboard</Text>

      <View style={styles.grid}>
        {TILES.map(tile => (
          <TouchableOpacity
            key={tile.screen}
            style={[styles.tile, { backgroundColor: tile.color }]}
            onPress={() => navigation.navigate(tile.screen)}
          >
            <Text style={styles.tileText}>{tile.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 24, paddingTop: 60 },
  greeting: { fontSize: 14, color: '#6b7280', marginBottom: 4 },
  heading: { fontSize: 26, fontWeight: 'bold', color: '#111827', marginBottom: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  tile: {
    width: '45%',
    aspectRatio: 1,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    margin: '2.5%',
  },
  tileText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  logoutBtn: { marginTop: 'auto', alignItems: 'center', paddingVertical: 12 },
  logoutText: { color: '#ef4444', fontSize: 15 },
});
