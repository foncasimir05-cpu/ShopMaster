import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../services/api';
import { formatCurrency } from 'shopmaster-shared';
import BarcodeScanner from '../components/BarcodeScanner';

const CAN_SCAN = Platform.OS !== 'web';

export default function ProductsScreen() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm] = useState({ name: '', sku: '', barcode: '', price: '', stock: '', category: '' });
  const [scannerVisible, setScannerVisible] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getProducts({ search });
      setProducts(data);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const openCreate = () => {
    setEditProduct(null);
    setForm({ name: '', sku: '', barcode: '', price: '', stock: '', category: '' });
    setModalVisible(true);
  };

  const openEdit = product => {
    setEditProduct(product);
    setForm({
      name: product.name,
      sku: product.sku ?? '',
      barcode: product.barcode ?? '',
      price: String(product.price),
      stock: String(product.stock),
      category: product.category ?? '',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name) { Alert.alert('Error', 'Product name is required'); return; }
    try {
      const payload = {
        name: form.name,
        sku: form.sku || undefined,
        barcode: form.barcode || undefined,
        price: parseFloat(form.price) || 0,
        stock: parseInt(form.stock, 10) || 0,
        category: form.category || undefined,
      };
      if (editProduct) {
        await api.updateProduct(editProduct.id, payload);
      } else {
        await api.createProduct(payload);
      }
      setModalVisible(false);
      fetchProducts();
    } catch (err) {
      Alert.alert('Save failed', err.response?.data?.error ?? err.message);
    }
  };

  const handleDelete = product => {
    Alert.alert('Delete product', `Delete "${product.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => { await api.deleteProduct(product.id); fetchProducts(); },
      },
    ]);
  };

  const handleBarcodeScan = (data) => {
    setForm(f => ({ ...f, barcode: data }));
    setScannerVisible(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Products</Text>
      <TextInput
        style={styles.search}
        placeholder="Search by name, SKU or barcode…"
        value={search}
        onChangeText={setSearch}
        returnKeyType="search"
        onSubmitEditing={fetchProducts}
      />
      <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
        <Text style={styles.addBtnText}>+ Add Product</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator size="large" color="#1a56db" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={p => p.id}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowSub}>{item.sku ?? '—'} · Stock: {item.stock}</Text>
              </View>
              <Text style={styles.rowPrice}>{formatCurrency(item.price)}</Text>
              <TouchableOpacity onPress={() => openEdit(item)} style={styles.iconBtn}>
                <Text>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item)} style={styles.iconBtn}>
                <Text>🗑</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No products found.</Text>}
        />
      )}

      {/* Product form modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{editProduct ? 'Edit Product' : 'New Product'}</Text>

            {['name', 'sku', 'price', 'stock', 'category'].map(field => (
              <TextInput
                key={field}
                style={styles.input}
                placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                value={form[field]}
                onChangeText={v => setForm(f => ({ ...f, [field]: v }))}
                keyboardType={['price', 'stock'].includes(field) ? 'numeric' : 'default'}
              />
            ))}

            {/* Barcode field with scan button (scan hidden on web/desktop) */}
            <View style={styles.barcodeRow}>
              <TextInput
                style={[styles.input, styles.barcodeInput]}
                placeholder="Barcode (optional) — or scan with a USB reader"
                value={form.barcode}
                onChangeText={v => setForm(f => ({ ...f, barcode: v }))}
                returnKeyType="done"
                blurOnSubmit={false}
                onSubmitEditing={() => {}}
              />
              {CAN_SCAN && (
                <TouchableOpacity
                  style={styles.scanBtn}
                  onPress={() => setScannerVisible(true)}
                >
                  <Ionicons name="barcode-outline" size={22} color="#fff" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelBtn}>
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Barcode scanner modal — native only */}
      {CAN_SCAN && (
        <Modal visible={scannerVisible} animationType="slide">
          <BarcodeScanner
            onScan={handleBarcodeScan}
            onClose={() => setScannerVisible(false)}
          />
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 16, paddingTop: 52 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 12 },
  search: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 10, fontSize: 14,
  },
  addBtn: {
    backgroundColor: '#1a56db', borderRadius: 8, paddingVertical: 10,
    alignItems: 'center', marginBottom: 12,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 8, padding: 12, marginBottom: 8,
  },
  rowName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  rowSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  rowPrice: { fontSize: 15, fontWeight: '700', color: '#1a56db', marginRight: 8 },
  iconBtn: { padding: 6 },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  modalBox: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 9, marginBottom: 10, fontSize: 14,
  },
  barcodeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  barcodeInput: { flex: 1, marginBottom: 0 },
  scanBtn: {
    backgroundColor: '#1a2e4a', borderRadius: 8,
    paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center',
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 4 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  saveBtn: { backgroundColor: '#1a56db', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20 },
});
