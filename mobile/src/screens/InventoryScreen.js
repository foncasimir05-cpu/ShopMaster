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
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as api from '../services/api';

export default function InventoryScreen() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [adjustItem, setAdjustItem] = useState(null);
  const [deltaInput, setDeltaInput] = useState('');
  const [adjusting, setAdjusting] = useState(false);

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

  const openAdjust = item => {
    setDeltaInput('');
    setAdjustItem(item);
  };

  const confirmAdjust = async () => {
    const delta = parseInt(deltaInput, 10);
    if (isNaN(delta)) {
      Alert.alert(t('common.error'), t('inventory.errors.invalidDelta'));
      return;
    }
    setAdjusting(true);
    try {
      const result = await api.adjustStock(adjustItem.id, delta, 'Manual adjustment');
      setAdjustItem(null);
      Alert.alert(t('inventory.updated'), t('inventory.stockUpdated', { prev: result.previousStock, new: result.newStock }));
      fetchInventory();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error ?? err.message);
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('inventory.title')}</Text>

      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>{t('inventory.lowStockOnly')}</Text>
        <Switch
          value={lowStockOnly}
          onValueChange={v => setLowStockOnly(v)}
          accessibilityLabel="Show low stock items only"
        />
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
                <Text style={styles.sub}>{item.sku ?? t('products.noSku')} · {item.category ?? '—'}</Text>
              </View>
              <View style={styles.stockBadge(item.stock)}>
                <Text style={styles.stockText}>{item.stock}</Text>
              </View>
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => openAdjust(item)}
                accessibilityRole="button"
                accessibilityLabel={`Adjust stock for ${item.name}, current stock: ${item.stock}`}
              >
                <Text style={styles.adjustBtnText}>{t('inventory.adjustStock')}</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>{t('inventory.noItems')}</Text>}
        />
      )}

      <Modal
        visible={!!adjustItem}
        transparent
        animationType="fade"
        onRequestClose={() => setAdjustItem(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('inventory.adjustStock')}</Text>
            <Text style={styles.modalSub}>
              {t('inventory.currentStock', { stock: adjustItem?.stock })}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t('inventory.deltaHint')}
              placeholderTextColor="#9ca3af"
              value={deltaInput}
              onChangeText={setDeltaInput}
              keyboardType="numeric"
              autoFocus
              accessibilityLabel="Stock delta"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setAdjustItem(null)}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.applyBtn, adjusting && { opacity: 0.6 }]}
                onPress={confirmAdjust}
                disabled={adjusting}
                accessibilityRole="button"
                accessibilityLabel="Apply stock adjustment"
              >
                {adjusting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.applyText}>{t('inventory.apply')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 4 },
  modalSub: { fontSize: 13, color: '#6b7280', marginBottom: 16 },
  modalInput: {
    borderWidth: 1.5, borderColor: '#d1d5db', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 16, color: '#111827', marginBottom: 20,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: '#d1d5db',
    borderRadius: 8, paddingVertical: 12, alignItems: 'center',
  },
  cancelText: { fontSize: 15, color: '#374151', fontWeight: '600' },
  applyBtn: {
    flex: 1, backgroundColor: '#ff5a1f',
    borderRadius: 8, paddingVertical: 12, alignItems: 'center',
  },
  applyText: { fontSize: 15, color: '#fff', fontWeight: '700' },
});
