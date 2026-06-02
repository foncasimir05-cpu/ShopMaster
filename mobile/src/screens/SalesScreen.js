import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import * as api from '../services/api';
import BarcodeScanner from '../components/BarcodeScanner';
import { computeCartTotals, formatCurrency } from 'shopmaster-shared';

export default function SalesScreen() {
  const [tab, setTab] = useState('pos'); // 'pos' | 'history'
  const [sales, setSales] = useState([]);
  const [cart, setCart] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [discount, setDiscount] = useState('0');

  useEffect(() => {
    if (tab === 'history') loadSales();
  }, [tab]);

  const loadSales = async () => {
    setLoading(true);
    try {
      setSales(await api.getSales());
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  };

  const onBarcode = async barcode => {
    setScanning(false);
    try {
      const results = await api.getProducts({ search: barcode });
      const product = results[0];
      if (!product) { Alert.alert('Not found', `No product with barcode "${barcode}"`); return; }
      addToCart(product);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const addToCart = product => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        return prev.map(i =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = productId => {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  };

  const totals = computeCartTotals(cart, { discount: parseFloat(discount) || 0 });

  const checkout = async () => {
    if (cart.length === 0) { Alert.alert('Empty cart', 'Add products first.'); return; }
    setLoading(true);
    try {
      const result = await api.createSale({
        items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity })),
        discount: totals.discount,
        tax: totals.tax,
      });
      Alert.alert('Sale completed!', `Total: ${formatCurrency(result.total)}\nSale ID: ${result.saleId.slice(0, 8)}`);
      setCart([]);
      setDiscount('0');
    } catch (err) {
      Alert.alert('Checkout failed', err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  };

  if (scanning) return <BarcodeScanner onScan={onBarcode} onClose={() => setScanning(false)} />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sales</Text>
      <View style={styles.tabs}>
        {['pos', 'history'].map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.activeTab]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.activeTabText]}>
              {t === 'pos' ? 'POS / Cart' : 'History'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'pos' ? (
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={styles.scanBtn} onPress={() => setScanning(true)}>
            <Text style={styles.scanBtnText}>Scan Barcode</Text>
          </TouchableOpacity>

          <FlatList
            data={cart}
            keyExtractor={i => i.product.id}
            renderItem={({ item }) => (
              <View style={styles.cartRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cartName}>{item.product.name}</Text>
                  <Text style={styles.cartSub}>{item.quantity} × {formatCurrency(item.product.price)}</Text>
                </View>
                <Text style={styles.cartTotal}>{formatCurrency(item.product.price * item.quantity)}</Text>
                <TouchableOpacity onPress={() => removeFromCart(item.product.id)} style={{ padding: 6 }}>
                  <Text style={{ color: '#ef4444' }}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.empty}>Cart is empty. Scan or add items.</Text>}
          />

          <View style={styles.summary}>
            <View style={styles.discountRow}>
              <Text>Discount ($):</Text>
              <TextInput
                style={styles.discountInput}
                value={discount}
                onChangeText={setDiscount}
                keyboardType="numeric"
              />
            </View>
            <Text style={styles.totalText}>Total: {formatCurrency(totals.total)}</Text>
            <TouchableOpacity style={styles.checkoutBtn} onPress={checkout} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.checkoutText}>Checkout</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          {loading ? (
            <ActivityIndicator size="large" color="#1a56db" style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              data={sales}
              keyExtractor={s => s.id}
              renderItem={({ item }) => (
                <View style={styles.historyRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyId}>#{item.id.slice(0, 8).toUpperCase()}</Text>
                    <Text style={styles.historySub}>{new Date(item.created_at).toLocaleString()}</Text>
                  </View>
                  <Text style={styles.historyTotal}>{formatCurrency(item.total)}</Text>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.empty}>No sales yet.</Text>}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 16, paddingTop: 52 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 12 },
  tabs: { flexDirection: 'row', marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#e5e7eb' },
  activeTab: { borderBottomColor: '#1a56db' },
  tabText: { color: '#6b7280', fontSize: 14 },
  activeTabText: { color: '#1a56db', fontWeight: '700' },
  scanBtn: { backgroundColor: '#0e9f6e', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginBottom: 12 },
  scanBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cartRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8 },
  cartName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  cartSub: { fontSize: 12, color: '#6b7280' },
  cartTotal: { fontSize: 14, fontWeight: '700', color: '#1a56db', marginRight: 8 },
  summary: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 8 },
  discountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  discountInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, width: 80, paddingHorizontal: 8, paddingVertical: 4, textAlign: 'right' },
  totalText: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 12 },
  checkoutBtn: { backgroundColor: '#1a56db', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  checkoutText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  historyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8 },
  historyId: { fontSize: 14, fontWeight: '600', color: '#111827' },
  historySub: { fontSize: 12, color: '#6b7280' },
  historyTotal: { fontSize: 15, fontWeight: '700', color: '#0e9f6e' },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
});
