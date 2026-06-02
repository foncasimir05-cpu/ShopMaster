import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Alert, ScrollView,
  Animated, Platform,
} from 'react-native';
import * as api from '../../services/api';
import { computeCartTotals, formatCurrency } from 'shopmaster-shared';
import { useUSBScanner } from '../../hooks/useUSBScanner';
import CartItem from './CartItem';
import PaymentModal from './PaymentModal';

const PAYMENT_METHODS = [
  { key: 'cash', label: 'Cash' },
  { key: 'card', label: 'Card' },
  { key: 'mobile_money', label: 'Mobile Money' },
];

const TAX_RATE = 0;

export default function POSScreen({ navigation }) {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [showPayment, setShowPayment] = useState(false);
  const [charging, setCharging] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);
  const [scanning, setScanning] = useState(false);
  const searchRef = useRef(null);
  const successAnim = useRef(new Animated.Value(0)).current;

  const fetchProducts = useCallback(async (q = '') => {
    setLoadingProducts(true);
    try {
      const data = await api.getProducts({ search: q, limit: 60 });
      setProducts(Array.isArray(data) ? data : data.products ?? []);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error ?? err.message);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const onBarcodeScanned = useCallback(async barcode => {
    try {
      const results = await api.getProducts({ search: barcode });
      const list = Array.isArray(results) ? results : results.products ?? [];
      const product = list[0];
      if (!product) { Alert.alert('Not found', `No product with barcode "${barcode}"`); return; }
      addToCart(product);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  }, []);

  useUSBScanner(onBarcodeScanned, !showPayment && !completedSale);

  const handleSearch = text => {
    setSearch(text);
    fetchProducts(text);
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

  const changeQty = (productId, qty) => {
    setCart(prev => prev.map(i => i.product.id === productId ? { ...i, quantity: qty } : i));
  };

  const totals = computeCartTotals(cart, {
    discount: parseFloat(discount) || 0,
    taxRate: TAX_RATE,
  });

  const handleCharge = () => {
    if (cart.length === 0) { Alert.alert('Empty cart', 'Add products first.'); return; }
    setShowPayment(true);
  };

  const handleConfirmPayment = async ({ tendered, change }) => {
    setCharging(true);
    try {
      const result = await api.createSale({
        items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity, unitPrice: i.product.price })),
        discount: totals.discount,
        taxRate: TAX_RATE,
        paymentMethod,
      });
      setShowPayment(false);
      setCompletedSale({ ...result, tendered, change });
      Animated.spring(successAnim, { toValue: 1, useNativeDriver: true }).start();
    } catch (err) {
      Alert.alert('Payment failed', err.response?.data?.error ?? err.message);
    } finally {
      setCharging(false);
    }
  };

  const startNewSale = () => {
    setCart([]);
    setDiscount('');
    setPaymentMethod('cash');
    setCompletedSale(null);
    successAnim.setValue(0);
    fetchProducts();
  };

  if (completedSale) {
    return (
      <Animated.View style={[styles.successScreen, { opacity: successAnim, transform: [{ scale: successAnim }] }]}>
        <Text style={styles.successIcon}>✓</Text>
        <Text style={styles.successTitle}>Sale Complete!</Text>
        <Text style={styles.successRef}>#{completedSale.saleId?.slice(0, 8).toUpperCase()}</Text>

        <View style={styles.successAmounts}>
          <Row label="Total" value={formatCurrency(completedSale.total)} bold />
          {completedSale.tendered > 0 && completedSale.tendered !== completedSale.total && (
            <>
              <Row label="Tendered" value={formatCurrency(completedSale.tendered)} />
              <Row label="Change" value={formatCurrency(completedSale.change)} color="#16a34a" bold />
            </>
          )}
        </View>

        <TouchableOpacity style={styles.newSaleBtn} onPress={startNewSale}>
          <Text style={styles.newSaleBtnText}>+ New Sale</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.viewSaleBtn}
          onPress={() => navigation.navigate('SalesHistory')}
        >
          <Text style={styles.viewSaleBtnText}>View Sales History</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <View style={styles.container}>
      {/* TOP: Search + scan */}
      <View style={styles.header}>
        <TextInput
          ref={searchRef}
          style={styles.searchInput}
          placeholder="Search product or scan barcode…"
          value={search}
          onChangeText={handleSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        <TouchableOpacity style={styles.cameraBtn} onPress={() => setScanning(true)}>
          <Text style={styles.cameraBtnText}>📷</Text>
        </TouchableOpacity>
      </View>

      {/* MIDDLE: Product grid */}
      {loadingProducts ? (
        <ActivityIndicator size="large" color="#1a56db" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={p => p.id}
          numColumns={3}
          style={styles.grid}
          contentContainerStyle={styles.gridContent}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.productCard} onPress={() => addToCart(item)}>
              <Text style={styles.productEmoji}>📦</Text>
              <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.productPrice}>{formatCurrency(item.price)}</Text>
              {item.stock <= 5 && <Text style={styles.lowStock}>Low: {item.stock}</Text>}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No products found.</Text>
          }
        />
      )}

      {/* BOTTOM PANEL: Cart + totals + charge */}
      <View style={styles.panel}>
        {cart.length > 0 && (
          <ScrollView style={styles.cartList} nestedScrollEnabled>
            {cart.map(item => (
              <CartItem
                key={item.product.id}
                item={item}
                onRemove={removeFromCart}
                onChangeQty={changeQty}
              />
            ))}
          </ScrollView>
        )}

        <View style={styles.totalsRow}>
          <View style={styles.totalsLeft}>
            <Text style={styles.totalsLine}>
              Subtotal: <Text style={styles.bold}>{formatCurrency(totals.subtotal)}</Text>
            </Text>
            {totals.tax > 0 && (
              <Text style={styles.totalsLine}>
                Tax: <Text style={styles.bold}>{formatCurrency(totals.tax)}</Text>
              </Text>
            )}
          </View>
          <View style={styles.discountWrap}>
            <Text style={styles.discountLabel}>Disc $</Text>
            <TextInput
              style={styles.discountInput}
              value={discount}
              onChangeText={setDiscount}
              keyboardType="numeric"
              placeholder="0"
            />
          </View>
        </View>

        <Text style={styles.totalBig}>{formatCurrency(totals.total)}</Text>

        <View style={styles.methodRow}>
          {PAYMENT_METHODS.map(m => (
            <TouchableOpacity
              key={m.key}
              style={[styles.methodPill, paymentMethod === m.key && styles.methodPillActive]}
              onPress={() => setPaymentMethod(m.key)}
            >
              <Text style={[styles.methodText, paymentMethod === m.key && styles.methodTextActive]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.chargeBtn, cart.length === 0 && styles.chargeBtnDisabled]}
          onPress={handleCharge}
          disabled={cart.length === 0}
        >
          <Text style={styles.chargeBtnText}>
            {cart.length === 0 ? 'Add items to charge' : `Charge ${formatCurrency(totals.total)}`}
          </Text>
        </TouchableOpacity>
      </View>

      <PaymentModal
        visible={showPayment}
        total={totals.total}
        paymentMethod={paymentMethod}
        onConfirm={handleConfirmPayment}
        onCancel={() => setShowPayment(false)}
        loading={charging}
      />

      {/* Camera scan modal */}
      {scanning && <CameraScanOverlay onScan={bc => { setScanning(false); onBarcodeScanned(bc); }} onClose={() => setScanning(false)} />}
    </View>
  );
}

function Row({ label, value, bold, color }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 }}>
      <Text style={{ fontSize: 15, color: '#6b7280' }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: bold ? '800' : '500', color: color ?? '#111827' }}>
        {value}
      </Text>
    </View>
  );
}

function CameraScanOverlay({ onScan, onClose }) {
  const BarcodeScanner = require('../../components/BarcodeScanner').default;
  return (
    <View style={StyleSheet.absoluteFill}>
      <BarcodeScanner onScan={onScan} onClose={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', paddingTop: 52 },

  header: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  searchInput: {
    flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14,
  },
  cameraBtn: {
    width: 44, height: 44, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db',
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  cameraBtnText: { fontSize: 20 },

  grid: { flex: 1 },
  gridContent: { paddingHorizontal: 8, paddingBottom: 4 },
  productCard: {
    flex: 1, margin: 4, backgroundColor: '#fff', borderRadius: 10,
    padding: 10, alignItems: 'center', minHeight: 90,
  },
  productEmoji: { fontSize: 24, marginBottom: 4 },
  productName: { fontSize: 11, color: '#374151', textAlign: 'center', fontWeight: '600' },
  productPrice: { fontSize: 12, color: '#1a56db', fontWeight: '700', marginTop: 4 },
  lowStock: { fontSize: 10, color: '#dc2626', marginTop: 2 },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40 },

  panel: {
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb',
    paddingHorizontal: 14, paddingBottom: 16, paddingTop: 8,
  },
  cartList: { maxHeight: 160 },

  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  totalsLeft: { flex: 1 },
  totalsLine: { fontSize: 13, color: '#6b7280' },
  bold: { fontWeight: '700', color: '#111827' },
  discountWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  discountLabel: { fontSize: 12, color: '#6b7280' },
  discountInput: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6,
    width: 68, paddingHorizontal: 8, paddingVertical: 4, fontSize: 14, textAlign: 'right',
  },

  totalBig: { fontSize: 30, fontWeight: '900', color: '#111827', marginVertical: 8, textAlign: 'right' },

  methodRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  methodPill: {
    flex: 1, borderWidth: 1.5, borderColor: '#d1d5db',
    borderRadius: 20, paddingVertical: 7, alignItems: 'center',
  },
  methodPillActive: { borderColor: '#1a56db', backgroundColor: '#eff6ff' },
  methodText: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  methodTextActive: { color: '#1a56db' },

  chargeBtn: {
    backgroundColor: '#1a56db', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
  },
  chargeBtnDisabled: { backgroundColor: '#93c5fd' },
  chargeBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },

  // Success screen
  successScreen: {
    flex: 1, backgroundColor: '#f0fdf4', justifyContent: 'center',
    alignItems: 'center', padding: 32, paddingTop: 60,
  },
  successIcon: {
    fontSize: 64, color: '#16a34a', backgroundColor: '#dcfce7',
    width: 110, height: 110, borderRadius: 55, textAlign: 'center',
    lineHeight: 110, marginBottom: 16,
  },
  successTitle: { fontSize: 28, fontWeight: '900', color: '#111827', marginBottom: 4 },
  successRef: { fontSize: 13, color: '#9ca3af', marginBottom: 24 },
  successAmounts: {
    width: '100%', backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 28,
  },
  newSaleBtn: {
    width: '100%', backgroundColor: '#1a56db', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginBottom: 10,
  },
  newSaleBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  viewSaleBtn: { paddingVertical: 10 },
  viewSaleBtnText: { color: '#1a56db', fontSize: 14, fontWeight: '600' },
});
