import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Alert, ScrollView,
  Animated, Platform, Modal, useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as api from '../../services/api';
import { computeCartTotals } from 'shopmaster-shared';
import { useShop } from '../../context/ShopContext';
import { useUSBScanner } from '../../hooks/useUSBScanner';
import { useOffline } from '../../context/OfflineContext';
import { cacheProducts, getCachedProducts, queueSale } from '../../services/offlineQueue';
import { printReceipt } from '../../services/receiptPrinter';
import CartItem from './CartItem';
import PaymentModal from './PaymentModal';

const PAYMENT_METHOD_KEYS = [
  { key: 'cash',         tKey: 'pos.cash',        icon: 'cash-outline' },
  { key: 'card',         tKey: 'pos.card',        icon: 'card-outline' },
  { key: 'mobile_money', tKey: 'pos.mobileMoney', icon: 'phone-portrait-outline' },
];

const TAX_RATE = 0;

// Deterministic accent colour based on product category
const CAT_MAP = {
  food:'#f59e0b', drink:'#06b6d4', bev:'#06b6d4', electr:'#6366f1',
  cloth:'#ec4899', fashion:'#ec4899', health:'#10b981', beauty:'#f43f5e',
  home:'#8b5cf6', office:'#0891b2', sport:'#16a34a', baby:'#f472b6',
};
const CAT_PALETTE = ['#2563eb','#7c3aed','#db2777','#059669','#d97706','#0891b2','#ea580c'];
function catColor(category) {
  if (!category) return '#2563eb';
  const k = category.toLowerCase();
  for (const [key, val] of Object.entries(CAT_MAP)) if (k.includes(key)) return val;
  let h = 0;
  for (let i = 0; i < category.length; i++) h = category.charCodeAt(i) + ((h << 5) - h);
  return CAT_PALETTE[Math.abs(h) % CAT_PALETTE.length];
}

export default function POSScreen({ navigation }) {
  const { t } = useTranslation();
  const { formatCurrency } = useShop();
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
  const [promoCode, setPromoCode] = useState('');
  const [promoData, setPromoData] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  const [variantPickerProduct, setVariantPickerProduct] = useState(null);
  const [variants, setVariants] = useState([]);
  const [loadingVariants, setLoadingVariants] = useState(false);

  const searchRef    = useRef(null);
  const successAnim  = useRef(new Animated.Value(0)).current;
  const isScanningRef = useRef(false);
  const { isOnline }  = useOffline();
  const { width }     = useWindowDimensions();
  // Responsive product grid columns: wide desktop → 4, medium → 3, small → 2
  const numProductCols = width >= 1000 ? 4 : width >= 600 ? 3 : 2;

  const scannerEnabled = !showPayment && !completedSale && !variantPickerProduct && !customerModalVisible;

  // Auto-focus search when POS tab becomes active so USB scanner works immediately
  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(() => searchRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }, [])
  );

  const fetchProducts = useCallback(async (q = '') => {
    setLoadingProducts(true);
    try {
      const data = await api.getProducts({ search: q, limit: 60 });
      const list = Array.isArray(data) ? data : data.products ?? [];
      setProducts(list);
      if (!q) await cacheProducts(list);
    } catch (err) {
      if (!err.response && err.request) {
        if (!q) {
          const cached = await getCachedProducts();
          if (cached.length > 0) setProducts(cached);
          else Alert.alert('Offline', 'No network and no cached products available.');
        }
      } else {
        Alert.alert('Error', err.response?.data?.error ?? err.message);
      }
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Auto-add when the search narrows to exactly 1 product and looks like a barcode
  // (no spaces, ≥ 5 chars). Covers scanners that don't append Enter, or slow Enter timing.
  useEffect(() => {
    const looksLikeBarcode = search.length >= 5 && !/\s/.test(search);
    if (!looksLikeBarcode || products.length !== 1 || loadingProducts || !scannerEnabled) return;

    const timer = setTimeout(() => {
      if (products.length === 1 && search.length >= 5 && !isScanningRef.current) {
        handleProductPress(products[0]);
        setSearch('');
        fetchProducts('');
      }
    }, 300);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products.length, search, loadingProducts, scannerEnabled]);

  // ── Cart helpers ─────────────────────────────────────────────────────────────

  const addToCart = useCallback((product, variant = null) => {
    const cartKey = variant ? `${product.id}__${variant.id}` : product.id;
    setCart(prev => {
      const existing = prev.find(i => i.cartKey === cartKey);
      if (existing) {
        return prev.map(i => i.cartKey === cartKey ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { cartKey, product, variant, quantity: 1 }];
    });
  }, []);

  const removeFromCart = useCallback(cartKey => {
    setCart(prev => prev.filter(i => i.cartKey !== cartKey));
  }, []);

  const changeQty = useCallback((cartKey, qty) => {
    setCart(prev => prev.map(i => i.cartKey === cartKey ? { ...i, quantity: qty } : i));
  }, []);

  // ── Barcode scan ─────────────────────────────────────────────────────────────

  const onBarcodeScanned = useCallback(async barcode => {
    // Lock prevents a second scan firing while the first API call is still in-flight
    if (isScanningRef.current) return;
    isScanningRef.current = true;
    try {
      const variantResults = await api.getProducts({ search: barcode });
      const list = Array.isArray(variantResults) ? variantResults : variantResults.products ?? [];
      const product = list[0];
      if (!product) { Alert.alert('Not found', `No product with barcode "${barcode}"`); return; }

      if (product.has_variants) {
        openVariantPicker(product);
      } else {
        addToCart(product);
      }
      setSearch('');
      fetchProducts('');
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      isScanningRef.current = false;
    }
  }, [fetchProducts, addToCart]);

  const handleCharge = useCallback(() => {
    if (cart.length === 0) { Alert.alert('Empty cart', 'Add products first.'); return; }
    setShowPayment(true);
  }, [cart]);

  useUSBScanner(onBarcodeScanned, scannerEnabled, handleCharge);

  // ── Variant picker ───────────────────────────────────────────────────────────

  const openVariantPicker = async (product) => {
    setVariantPickerProduct(product);
    setLoadingVariants(true);
    try {
      const data = await api.getVariants(product.id);
      setVariants(data);
    } catch (err) {
      Alert.alert('Error', err.message);
      setVariantPickerProduct(null);
    } finally {
      setLoadingVariants(false);
    }
  };

  const handleProductPress = (product) => {
    if (product.has_variants) openVariantPicker(product);
    else addToCart(product);
  };

  // ── Customer picker ──────────────────────────────────────────────────────────

  const openCustomerPicker = async () => {
    setCustomerSearch('');
    setCustomerModalVisible(true);
    setLoadingCustomers(true);
    try {
      const data = await api.getCustomers({ limit: 30 });
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const searchCustomers = async (text) => {
    setCustomerSearch(text);
    setLoadingCustomers(true);
    try {
      const data = await api.getCustomers({ search: text, limit: 30 });
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn(err);
    } finally {
      setLoadingCustomers(false);
    }
  };

  // ── Promo code ───────────────────────────────────────────────────────────────

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    try {
      const subtotal = cart.reduce((s, i) => s + (i.variant ? i.variant.price : i.product.price) * i.quantity, 0);
      const result = await api.validatePromo(promoCode.trim(), subtotal - (parseFloat(discount) || 0));
      if (result.valid) {
        setPromoData(result);
      } else {
        Alert.alert('Invalid Promo', result.error);
        setPromoData(null);
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setPromoLoading(false);
    }
  };

  // ── Payment ──────────────────────────────────────────────────────────────────

  const handleSearch = text => {
    setSearch(text);
    fetchProducts(text);
  };

  const totals = computeCartTotals(
    cart.map(i => ({ product: { ...i.product, price: i.variant ? i.variant.price : i.product.price }, quantity: i.quantity })),
    { discount: (parseFloat(discount) || 0) + (promoData?.discount ?? 0), taxRate: TAX_RATE }
  );

  const handleConfirmPayment = async ({ tendered, change }) => {
    setCharging(true);
    const salePayload = {
      items: cart.map(i => ({
        productId:  i.product.id,
        variantId:  i.variant?.id ?? null,
        quantity:   i.quantity,
        unitPrice:  i.variant ? i.variant.price : i.product.price,
      })),
      discount:      totals.discount,
      taxRate:       TAX_RATE,
      paymentMethod,
      customerId:    selectedCustomer?.id ?? null,
      promoCode:     promoData ? promoCode.trim() : undefined,
    };
    try {
      const result = await api.createSale(salePayload);
      setShowPayment(false);
      setCompletedSale({ ...result, tendered, change, queued: false });
      Animated.spring(successAnim, { toValue: 1, useNativeDriver: true }).start();
    } catch (err) {
      if (!err.response && err.request) {
        await queueSale(salePayload);
        setShowPayment(false);
        const offlineItems = cart.map(i => ({
          product_name: i.product.name,
          quantity:     i.quantity,
          unit_price:   i.variant?.price ?? i.product.price,
          subtotal:     (i.variant?.price ?? i.product.price) * i.quantity,
        }));
        setCompletedSale({ queued: true, total: totals.total, tendered, change, items: offlineItems });
        Animated.spring(successAnim, { toValue: 1, useNativeDriver: true }).start();
      } else {
        Alert.alert('Payment failed', err.response?.data?.error ?? err.message);
      }
    } finally {
      setCharging(false);
    }
  };

  const handlePrintReceipt = async () => {
    let shop = null;
    try { shop = await api.getSettings(); } catch {}
    await printReceipt({
      shop,
      sale: {
        saleId:        completedSale.saleId,
        total:         completedSale.total,
        discount:      completedSale.discount ?? 0,
        tax:           completedSale.tax ?? 0,
        paymentMethod,
        created_at:    new Date().toISOString(),
        customer_name: selectedCustomer?.name,
      },
      items:    completedSale.items ?? [],
      tendered: completedSale.tendered,
      change:   completedSale.change,
    });
  };

  const startNewSale = () => {
    setCart([]);
    setDiscount('');
    setPaymentMethod('cash');
    setShowPayment(false);
    setCompletedSale(null);
    setSelectedCustomer(null);
    setPromoCode('');
    setPromoData(null);
    successAnim.setValue(0);
    fetchProducts();
  };

  // ── Success screen ───────────────────────────────────────────────────────────

  if (completedSale) {
    const queued = completedSale.queued;
    return (
      <Animated.View style={[
        styles.successScreen,
        queued && { backgroundColor: '#fffbeb' },
        { opacity: successAnim, transform: [{ scale: successAnim }] },
      ]}>
        <View style={[styles.successIconWrap, queued && { backgroundColor: '#fef3c7' }]}>
          <Text style={styles.successIconText}>{queued ? '⏳' : '✓'}</Text>
        </View>
        <Text style={styles.successTitle}>{queued ? t('pos.queuedSales', { count: 1 }) : t('pos.saleComplete')}</Text>
        <Text style={styles.successRef}>
          {queued ? t('pos.offline') : `#${completedSale.saleId?.slice(0, 8).toUpperCase()}`}
        </Text>

        <View style={styles.successAmounts}>
          <Row label={t('pos.total')} value={formatCurrency(completedSale.total)} bold />
          {completedSale.tendered > 0 && completedSale.tendered !== completedSale.total && (
            <>
              <Row label="Tendered" value={formatCurrency(completedSale.tendered)} />
              <Row label="Change" value={formatCurrency(completedSale.change)} color="#059669" bold />
            </>
          )}
          {selectedCustomer && !queued && (
            <Row label="Loyalty" value={`+${Math.floor(completedSale.total / 100)} pts`} color="#d97706" />
          )}
        </View>

        {!queued && (
          <TouchableOpacity style={styles.printBtn} onPress={handlePrintReceipt}>
            <Ionicons name="print-outline" size={16} color="#fff" />
            <Text style={styles.printBtnText}>{t('pos.printReceipt')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.newSaleBtn} onPress={startNewSale}>
          <Ionicons name="add-circle-outline" size={18} color="#fff" />
          <Text style={styles.newSaleBtnText}>{t('pos.newSale')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.viewSaleBtn} onPress={() => navigation.navigate('SalesHistory')}>
          <Text style={styles.viewSaleBtnText}>{t('sales.title')} →</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // ── Main POS screen ──────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={13} color="#fff" />
          <Text style={styles.offlineBannerText}>{t('pos.offline')}</Text>
        </View>
      )}

      {/* Search bar */}
      <View style={styles.header}>
        <View style={styles.searchWrapper}>
          <Ionicons name="search-outline" size={15} color="#94a3b8" />
          <TextInput
            ref={searchRef}
            style={styles.searchInput}
            placeholder={t('pos.searchPlaceholder')}
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={handleSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {/* Green dot = USB scanner is active */}
          <View style={[styles.scannerDot, scannerEnabled && styles.scannerDotActive]} />
        </View>
        <TouchableOpacity style={styles.cameraBtn} onPress={() => setScanning(true)}>
          <Ionicons name="barcode-outline" size={20} color="#1a2e4a" />
        </TouchableOpacity>
      </View>

      {/* Customer selector */}
      <TouchableOpacity style={styles.customerBar} onPress={openCustomerPicker} activeOpacity={0.7}>
        <Ionicons name="person-circle-outline" size={16} color={selectedCustomer ? '#2563eb' : '#94a3b8'} />
        {selectedCustomer ? (
          <Text style={styles.customerBarName} numberOfLines={1}>{selectedCustomer.name}</Text>
        ) : (
          <Text style={styles.customerBarPlaceholder}>{t('pos.addCustomer')}</Text>
        )}
        {selectedCustomer && (
          <TouchableOpacity onPress={() => setSelectedCustomer(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Product grid */}
      {loadingProducts ? (
        <View style={styles.loadingGrid}>
          {Array.from({ length: numProductCols * 2 }).map((_, i) => (
            <View key={i} style={[styles.skeletonCard, { opacity: 1 - (i % 4) * 0.1 }]} />
          ))}
        </View>
      ) : (
        <FlatList
          key={numProductCols}
          data={products}
          keyExtractor={p => p.id}
          numColumns={numProductCols}
          style={styles.grid}
          contentContainerStyle={styles.gridContent}
          renderItem={({ item }) => {
            const accent = catColor(item.category);
            const isOOS  = !item.has_variants && item.stock === 0;
            const isLow  = !item.has_variants && item.stock > 0 && item.stock <= 5;
            return (
              <TouchableOpacity
                style={[styles.productCard, isOOS && styles.productCardOOS]}
                onPress={() => handleProductPress(item)}
                activeOpacity={0.75}
              >
                {/* Category accent strip */}
                <View style={[styles.cardStrip, { backgroundColor: accent }]} />

                <View style={styles.cardContent}>
                  <Text style={[styles.productName, isOOS && { color: '#94a3b8' }]} numberOfLines={3}>
                    {item.name}
                  </Text>

                  <View style={styles.cardFooter}>
                    <Text style={[styles.productPrice, { color: isOOS ? '#94a3b8' : accent }]}>
                      {formatCurrency(item.price)}
                    </Text>
                    <View style={styles.cardBadgeWrap}>
                      {item.has_variants && (
                        <View style={styles.varsBadge}>
                          <Text style={styles.varsBadgeText}>VAR</Text>
                        </View>
                      )}
                      {isOOS && (
                        <View style={styles.oosBadge}>
                          <Text style={styles.oosBadgeText}>OUT</Text>
                        </View>
                      )}
                      {isLow && (
                        <View style={styles.lowBadge}>
                          <Text style={styles.lowBadgeText}>{item.stock}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="cube-outline" size={48} color="#cbd5e1" />
              <Text style={styles.empty}>{t('pos.noProductsFound')}</Text>
              <Text style={styles.emptySub}>{t('pos.tryDifferent')}</Text>
            </View>
          }
        />
      )}

      {/* Bottom panel */}
      <View style={styles.panel}>
        {cart.length > 0 && (
          <ScrollView style={styles.cartList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {cart.map(item => (
              <CartItem key={item.cartKey} item={item} onRemove={removeFromCart} onChangeQty={changeQty} />
            ))}
          </ScrollView>
        )}

        {/* Promo row */}
        <View style={styles.promoRow}>
          <TextInput
            style={styles.promoInput}
            placeholder={t('pos.promoCode')}
            placeholderTextColor="#94a3b8"
            value={promoCode}
            onChangeText={t => { setPromoCode(t); if (!t) setPromoData(null); }}
            autoCapitalize="characters"
            editable={!promoData}
          />
          {promoData ? (
            <TouchableOpacity style={styles.promoRemoveBtn} onPress={() => { setPromoData(null); setPromoCode(''); }}>
              <Text style={styles.promoRemoveText}>✕ {promoData.promoName}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.promoApplyBtn, (!promoCode.trim() || promoLoading) && styles.promoApplyBtnDisabled]}
              onPress={handleApplyPromo}
              disabled={promoLoading || !promoCode.trim()}
            >
              {promoLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.promoApplyText}>{t('pos.promoApply')}</Text>}
            </TouchableOpacity>
          )}
        </View>
        {promoData && (
          <Text style={styles.promoSaved}>"{promoData.promoName}" — saving {formatCurrency(promoData.discount)}</Text>
        )}

        {/* Totals */}
        <View style={styles.totalsRow}>
          <View style={styles.totalsLeft}>
            <Text style={styles.totalsLine}>
              {t('pos.subtotal')} <Text style={styles.totalsValue}>{formatCurrency(totals.subtotal)}</Text>
            </Text>
            {totals.discount > 0 && (
              <Text style={styles.totalsLine}>
                {t('pos.discount')} <Text style={[styles.totalsValue, { color: '#059669' }]}>-{formatCurrency(totals.discount)}</Text>
              </Text>
            )}
          </View>
          <View style={styles.discountWrap}>
            <Text style={styles.discountLabel}>{t('pos.discountLabel')}</Text>
            <TextInput
              style={styles.discountInput}
              value={discount}
              onChangeText={setDiscount}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#94a3b8"
            />
          </View>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t('pos.total')}</Text>
          <Text style={styles.totalBig}>{formatCurrency(totals.total)}</Text>
        </View>

        {/* Payment method pills */}
        <View style={styles.methodRow}>
          {PAYMENT_METHOD_KEYS.map(m => (
            <TouchableOpacity
              key={m.key}
              style={[styles.methodPill, paymentMethod === m.key && styles.methodPillActive]}
              onPress={() => setPaymentMethod(m.key)}
            >
              <Ionicons
                name={m.icon}
                size={13}
                color={paymentMethod === m.key ? '#2563eb' : '#94a3b8'}
                style={{ marginRight: 3 }}
              />
              <Text style={[styles.methodText, paymentMethod === m.key && styles.methodTextActive]}>
                {t(m.tKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.chargeBtn, cart.length === 0 && styles.chargeBtnDisabled]}
          onPress={handleCharge}
          disabled={cart.length === 0}
          activeOpacity={0.85}
        >
          {cart.length === 0 ? (
            <Text style={styles.chargeBtnText}>{t('pos.emptyCart')}</Text>
          ) : (
            <View style={styles.chargeBtnInner}>
              <Ionicons name="flash" size={18} color="#fff" />
              <Text style={styles.chargeBtnText}>{t('pos.charge', { amount: formatCurrency(totals.total) })}</Text>
            </View>
          )}
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

      {scanning && <CameraScanOverlay onScan={bc => { setScanning(false); onBarcodeScanned(bc); }} onClose={() => setScanning(false)} />}

      {/* Variant Picker Modal */}
      <Modal visible={!!variantPickerProduct} transparent animationType="slide" onRequestClose={() => setVariantPickerProduct(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sheetCard}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>{variantPickerProduct?.name}</Text>
                <Text style={styles.sheetSub}>{t('pos.selectVariant')}</Text>
              </View>
              <TouchableOpacity onPress={() => setVariantPickerProduct(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {loadingVariants ? (
              <ActivityIndicator size="large" color="#2563eb" style={{ padding: 24 }} />
            ) : variants.length === 0 ? (
              <Text style={styles.sheetEmpty}>No variants configured for this product.</Text>
            ) : (
              <ScrollView>
                {variants.map(v => (
                  <TouchableOpacity
                    key={v.id}
                    style={[styles.variantRow, v.stock === 0 && styles.variantRowDisabled]}
                    onPress={() => {
                      if (v.stock === 0) { Alert.alert('Out of stock', `${v.name} is out of stock.`); return; }
                      addToCart(variantPickerProduct, v);
                      setVariantPickerProduct(null);
                    }}
                    disabled={v.stock === 0}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.variantName, v.stock === 0 && { color: '#94a3b8' }]}>{v.name}</Text>
                      {v.sku ? <Text style={styles.variantSku}>SKU: {v.sku}</Text> : null}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.variantPrice}>{formatCurrency(v.price)}</Text>
                      <Text style={[
                        styles.variantStock,
                        v.stock <= 5 && v.stock > 0 && { color: '#d97706' },
                        v.stock === 0 && { color: '#dc2626' },
                      ]}>
                        {v.stock === 0 ? t('pos.outOfStock') : t('products.inStock', { count: v.stock })}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Customer Picker Modal */}
      <Modal visible={customerModalVisible} transparent animationType="slide" onRequestClose={() => setCustomerModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sheetCard}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('pos.customer')}</Text>
              <TouchableOpacity onPress={() => setCustomerModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <View style={styles.custSearchRow}>
              <Ionicons name="search" size={14} color="#94a3b8" />
              <TextInput
                style={styles.custSearchInput}
                placeholder={t('pos.searchCustomer')}
                placeholderTextColor="#94a3b8"
                value={customerSearch}
                onChangeText={searchCustomers}
                autoFocus
              />
            </View>

            {loadingCustomers ? (
              <ActivityIndicator style={{ padding: 24 }} color="#2563eb" />
            ) : customers.length === 0 ? (
              <Text style={styles.sheetEmpty}>No customers found.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 300 }}>
                {customers.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.custRow}
                    onPress={() => { setSelectedCustomer(c); setCustomerModalVisible(false); }}
                  >
                    <View style={styles.custAvatar}>
                      <Text style={styles.custAvatarText}>{c.name[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.custName}>{c.name}</Text>
                      {c.phone ? <Text style={styles.custPhone}>{c.phone}</Text> : null}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.custPoints}>{c.loyalty_points} pts</Text>
                      <Text style={styles.custVisits}>{c.visit_count} visits</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.skipBtn} onPress={() => setCustomerModalVisible(false)}>
              <Text style={styles.skipBtnText}>Skip — no customer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Row({ label, value, bold, color }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 5 }}>
      <Text style={{ fontSize: 14, color: '#64748b' }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: bold ? '800' : '500', color: color ?? '#0f172a' }}>{value}</Text>
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
  container: { flex: 1, backgroundColor: '#f1f5f9', paddingTop: 52 },

  offlineBanner: {
    backgroundColor: '#dc2626', paddingHorizontal: 14, paddingVertical: 7,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  offlineBannerText: { color: '#fff', fontSize: 12, fontWeight: '600', flex: 1 },

  // Search bar
  header: {
    flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 8,
    paddingTop: 4, gap: 8, alignItems: 'center',
  },
  searchWrapper: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12,
    borderWidth: 1.5, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: '#0f172a' },
  scannerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e2e8f0' },
  scannerDotActive: { backgroundColor: '#22c55e' },
  cameraBtn: {
    width: 46, height: 46, backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },

  customerBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 12, marginBottom: 8,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  customerBarName: { flex: 1, fontSize: 13, fontWeight: '700', color: '#2563eb' },
  customerBarPlaceholder: { flex: 1, fontSize: 13, color: '#94a3b8' },

  // Product grid
  grid: { flex: 1 },
  gridContent: { paddingHorizontal: 8, paddingBottom: 4 },
  loadingGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 8, paddingTop: 4,
  },
  skeletonCard: {
    flex: 1, margin: 4, height: 90, minWidth: 80,
    backgroundColor: '#e2e8f0', borderRadius: 12,
  },
  productCard: {
    flex: 1, margin: 4,
    backgroundColor: '#fff', borderRadius: 12,
    minHeight: 90, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
    borderWidth: 1, borderColor: '#f1f5f9',
  },
  productCardOOS: { opacity: 0.65 },
  cardStrip: { height: 4, width: '100%' },
  cardContent: { flex: 1, padding: 8, justifyContent: 'space-between' },
  productName: { fontSize: 11.5, color: '#0f172a', fontWeight: '600', lineHeight: 16 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
  productPrice: { fontSize: 12.5, fontWeight: '800' },
  cardBadgeWrap: { flexDirection: 'row', gap: 3 },
  varsBadge: {
    backgroundColor: '#f3e8ff', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1,
  },
  varsBadgeText: { fontSize: 8, color: '#7c3aed', fontWeight: '800', letterSpacing: 0.3 },
  oosBadge: {
    backgroundColor: '#fee2e2', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1,
  },
  oosBadgeText: { fontSize: 8, color: '#dc2626', fontWeight: '800' },
  lowBadge: {
    backgroundColor: '#fef3c7', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1,
  },
  lowBadgeText: { fontSize: 8, color: '#d97706', fontWeight: '800' },
  emptyWrap: { alignItems: 'center', marginTop: 48, gap: 8 },
  empty: { fontSize: 15, color: '#64748b', fontWeight: '600' },
  emptySub: { fontSize: 12, color: '#94a3b8' },

  // Bottom panel
  panel: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    borderTopWidth: 1, borderTopColor: '#e2e8f0',
    paddingHorizontal: 14, paddingBottom: 16, paddingTop: 12,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 16, elevation: 10,
  },
  cartList: { maxHeight: 155 },

  promoRow: { flexDirection: 'row', gap: 8, marginTop: 6, marginBottom: 2 },
  promoInput: {
    flex: 1, borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7, fontSize: 13,
    backgroundColor: '#f8fafc', color: '#0f172a',
  },
  promoApplyBtn: { backgroundColor: '#7c3aed', borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' },
  promoApplyBtnDisabled: { backgroundColor: '#c4b5fd' },
  promoApplyText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  promoRemoveBtn: { backgroundColor: '#dcfce7', borderRadius: 8, paddingHorizontal: 10, justifyContent: 'center' },
  promoRemoveText: { color: '#15803d', fontWeight: '700', fontSize: 12 },
  promoSaved: { fontSize: 11, color: '#15803d', fontWeight: '600', marginBottom: 2 },

  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  totalsLeft: { flex: 1, gap: 2 },
  totalsLine: { fontSize: 12.5, color: '#64748b' },
  totalsValue: { fontWeight: '700', color: '#0f172a' },
  discountWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  discountLabel: { fontSize: 12, color: '#64748b' },
  discountInput: {
    borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 8,
    width: 68, paddingHorizontal: 8, paddingVertical: 5,
    fontSize: 14, textAlign: 'right', color: '#0f172a',
  },

  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'baseline', marginVertical: 6,
    borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 6,
  },
  totalLabel: { fontSize: 10, fontWeight: '800', color: '#94a3b8', letterSpacing: 1.2 },
  totalBig: { fontSize: 28, fontWeight: '900', color: '#0f172a' },

  methodRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  methodPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 20,
    paddingVertical: 7, backgroundColor: '#f8fafc',
  },
  methodPillActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  methodText: { fontSize: 11.5, color: '#64748b', fontWeight: '600' },
  methodTextActive: { color: '#2563eb', fontWeight: '700' },

  chargeBtn: {
    backgroundColor: '#1a2e4a', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  chargeBtnDisabled: { backgroundColor: '#cbd5e1' },
  chargeBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chargeBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

  // Success screen
  successScreen: {
    flex: 1, backgroundColor: '#f0fdf4',
    justifyContent: 'center', alignItems: 'center',
    padding: 32, paddingTop: 60,
  },
  successIconWrap: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: '#dcfce7', justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  successIconText: { fontSize: 52, lineHeight: 60 },
  successTitle: { fontSize: 28, fontWeight: '900', color: '#0f172a', marginBottom: 4 },
  successRef: { fontSize: 13, color: '#94a3b8', marginBottom: 24 },
  successAmounts: {
    width: '100%', backgroundColor: '#fff', borderRadius: 14,
    padding: 16, marginBottom: 28,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  printBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#374151', borderRadius: 12, paddingVertical: 14, marginBottom: 10,
  },
  printBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  newSaleBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#1a2e4a', borderRadius: 14, paddingVertical: 16, marginBottom: 10,
  },
  newSaleBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  viewSaleBtn: { paddingVertical: 10 },
  viewSaleBtnText: { color: '#2563eb', fontSize: 14, fontWeight: '600' },

  // Sheet modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheetCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36, maxHeight: '82%',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0',
    alignSelf: 'center', marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 16,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  sheetSub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  sheetEmpty: { textAlign: 'center', color: '#94a3b8', padding: 24, fontSize: 14 },

  variantRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  variantRowDisabled: { opacity: 0.4 },
  variantName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  variantSku: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  variantPrice: { fontSize: 15, fontWeight: '800', color: '#2563eb' },
  variantStock: { fontSize: 11, color: '#059669', marginTop: 2 },

  custSearchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f1f5f9', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 9, marginBottom: 12,
  },
  custSearchInput: { flex: 1, fontSize: 14, color: '#0f172a' },
  custRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  custAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center',
  },
  custAvatarText: { fontSize: 16, fontWeight: '800', color: '#2563eb' },
  custName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  custPhone: { fontSize: 12, color: '#64748b', marginTop: 1 },
  custPoints: { fontSize: 12, fontWeight: '700', color: '#d97706' },
  custVisits: { fontSize: 11, color: '#94a3b8', marginTop: 1 },

  skipBtn: {
    marginTop: 14, backgroundColor: '#f1f5f9',
    borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  skipBtnText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
});
