import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Switch,
} from 'react-native';
import * as api from '../services/api';

export default function InventoryScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.getInventory({ lowStock: lowStockOnly }));
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }, [lowStockOnly]);

  useEffect(() => { fetchInventory(); }, [fetchInventory]);

  const promptAdjust = item => {
    let deltaText = '';
    Alert.prompt(
      'Adjust Stock',
      `Current stock: ${item.stock}\nEnter delta (e.g. +10 or -5):`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply',
          onPress: async value => {
            const delta = parseInt(value, 10);
            if (isNaN(delta)) { Alert.alert('Invalid', 'Enter a valid number'); return; }
            try {
              const result = await api.adjustStock(item.id, delta, 'Manual adjustment');
              Alert.alert('Updated', `Stock: ${result.previousStock} → ${result.newStock}`);
              fetchInventory();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error ?? err.message);
            }
          },
        },
      ],
      'plain-text'
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inventory</Text>

      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Low stock only</Text>
        <Switch value={lowStockOnly} onValueChange={v => setLowStockOnly(v)} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#ff5a1f" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.sub}>{item.sku ?? 'No SKU'} · {item.category ?? 'Uncategorised'}</Text>
              </View>
              <View style={styles.stockBadge(item.stock)}>
                <Text style={styles.stockText}>{item.stock}</Text>
              </View>
              <TouchableOpacity style={styles.adjustBtn} onPress={() => promptAdjust(item)}>
                <Text style={styles.adjustBtnText}>Adjust</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No inventory items.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 16, paddingTop: 52 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 16 },
  filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  filterLabel: { fontSize: 14, color: '#374151' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8 },
  name: { fontSize: 15, fontWeight: '600', color: '#111827' },
  sub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  stockBadge: stock => ({
    backgroundColor: stock <= 5 ? '#fef2f2' : '#f0fdf4',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
  }),
  stockText: { fontWeight: '700', fontSize: 14 },
  adjustBtn: { backgroundColor: '#ff5a1f', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  adjustBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
});
