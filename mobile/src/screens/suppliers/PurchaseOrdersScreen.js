import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  Modal, StyleSheet, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useShop } from '../../context/ShopContext';
import * as api from '../../services/api';

const STATUS_COLORS = { pending: '#d97706', partial: '#1a56db', received: '#16a34a' };

export default function PurchaseOrdersScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const { formatCurrency } = useShop();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const [createVisible, setCreateVisible] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [poItems, setPoItems] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [poNotes, setPoNotes] = useState('');
  const [creating, setCreating] = useState(false);

  const [receiveVisible, setReceiveVisible] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [receiveQtys, setReceiveQtys] = useState({});
  const [receiving, setReceiving] = useState(false);

  const STATUS_KEYS = ['all', 'pending', 'partial', 'received'];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getPurchaseOrders(statusFilter !== 'all' ? { status: statusFilter } : {});
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openCreate = async () => {
    setPoItems([]);
    setPoNotes('');
    setSelectedSupplier(null);
    setProductSearch('');
    setProductResults([]);
    setCreateVisible(true);
    try {
      const data = await api.getSuppliers();
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (err) { console.warn(err); }
  };

  const searchProducts = async (q) => {
    setProductSearch(q);
    if (!q.trim()) { setProductResults([]); return; }
    try {
      const data = await api.getProducts({ search: q, limit: 20 });
      setProductResults(Array.isArray(data) ? data : data.products ?? []);
    } catch (err) { console.warn(err); }
  };

  const addPoItem = (product) => {
    setPoItems(prev => {
      if (prev.find(i => i.productId === product.id)) return prev;
      return [...prev, { productId: product.id, name: product.name, sku: product.sku, qtyOrdered: '1', unitCost: product.cost ? String(product.cost) : '' }];
    });
    setProductSearch('');
    setProductResults([]);
  };

  const updatePoItem = (productId, field, value) => {
    setPoItems(prev => prev.map(i => i.productId === productId ? { ...i, [field]: value } : i));
  };

  const removePoItem = (productId) => {
    setPoItems(prev => prev.filter(i => i.productId !== productId));
  };

  const handleCreate = async () => {
    if (poItems.length === 0) { Alert.alert(t('common.error'), t('purchases.minOneProduct')); return; }
    setCreating(true);
    try {
      await api.createPurchaseOrder({
        supplierId: selectedSupplier?.id ?? null,
        notes: poNotes || null,
        items: poItems.map(i => ({ productId: i.productId, qtyOrdered: parseInt(i.qtyOrdered, 10) || 1, unitCost: parseFloat(i.unitCost) || 0 })),
      });
      setCreateVisible(false);
      load();
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.error ?? err.message);
    } finally {
      setCreating(false);
    }
  };

  const openReceive = async (order) => {
    setReceiving(false);
    try {
      const detail = await api.getPurchaseOrder(order.id);
      setSelectedPO(detail);
      const qtys = {};
      (detail.items ?? []).forEach(i => { qtys[i.id] = ''; });
      setReceiveQtys(qtys);
      setReceiveVisible(true);
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.error ?? err.message);
    }
  };

  const handleReceive = async () => {
    const items = Object.entries(receiveQtys)
      .filter(([, qty]) => qty && parseInt(qty, 10) > 0)
      .map(([itemId, qty]) => ({ itemId, qtyReceived: parseInt(qty, 10) }));
    if (items.length === 0) { Alert.alert(t('common.error'), t('purchases.minOneQty')); return; }
    setReceiving(true);
    try {
      await api.receivePurchaseOrder(selectedPO.id, { items });
      setReceiveVisible(false);
      load();
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.error ?? err.message);
    } finally {
      setReceiving(false);
    }
  };

  const handleDelete = (id) => {
    Alert.alert(t('purchases.deleteOrder'), t('purchases.deleteOrderMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive',
        onPress: async () => {
          try { await api.deletePurchaseOrder(id); load(); }
          catch (err) { Alert.alert(t('common.error'), err.response?.data?.error ?? err.message); }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1a2e4a" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('purchases.title')}</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}>
        {STATUS_KEYS.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.filterPill, statusFilter === s && styles.filterPillActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.filterText, statusFilter === s && styles.filterTextActive]}>
              {t(`purchases.status.${s}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color="#1a2e4a" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={o => o.id}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Text style={styles.cardId}>PO #{item.id.slice(0, 8).toUpperCase()}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[item.status] ?? '#6b7280') + '20' }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] ?? '#6b7280' }]}>
                      {t(`purchases.status.${item.status}`, { defaultValue: item.status })}
                    </Text>
                  </View>
                </View>
                {item.supplier_name ? <Text style={styles.cardSub}>{item.supplier_name}</Text> : null}
                <Text style={styles.cardSub}>
                  {item.item_count} {item.item_count !== 1 ? t('purchases.itemCount_plural', { count: item.item_count }).replace(/^\d+ /, '') : t('purchases.itemCount', { count: 1 }).replace(/^1 /, '')} · {formatCurrency(item.total_amount)}
                </Text>
                <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleDateString(i18n.language)}</Text>
              </View>
              <View style={styles.cardActions}>
                {item.status !== 'received' && (
                  <TouchableOpacity style={styles.receiveBtn} onPress={() => openReceive(item)}>
                    <Ionicons name="checkmark-circle" size={14} color="#fff" />
                    <Text style={styles.receiveBtnText}>{t('purchases.receive')}</Text>
                  </TouchableOpacity>
                )}
                {item.status === 'pending' && (
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
                    <Ionicons name="trash" size={16} color="#dc2626" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>{t('purchases.noOrdersFound')}</Text>}
        />
      )}

      {/* Create PO Modal */}
      <Modal visible={createVisible} transparent animationType="slide" onRequestClose={() => setCreateVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('purchases.newPurchaseOrder')}</Text>
              <TouchableOpacity onPress={() => setCreateVisible(false)}>
                <Ionicons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>{t('purchases.supplierOptional')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
                <TouchableOpacity
                  style={[styles.supplierPill, !selectedSupplier && styles.supplierPillActive]}
                  onPress={() => setSelectedSupplier(null)}
                >
                  <Text style={[styles.supplierPillText, !selectedSupplier && styles.supplierPillTextActive]}>{t('purchases.noSupplier')}</Text>
                </TouchableOpacity>
                {suppliers.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.supplierPill, selectedSupplier?.id === s.id && styles.supplierPillActive]}
                    onPress={() => setSelectedSupplier(s)}
                  >
                    <Text style={[styles.supplierPillText, selectedSupplier?.id === s.id && styles.supplierPillTextActive]} numberOfLines={1}>
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>{t('purchases.addProducts')}</Text>
              <View style={styles.searchRow}>
                <Ionicons name="search" size={14} color="#9ca3af" />
                <TextInput
                  style={styles.searchInput}
                  placeholder={t('purchases.searchProduct')}
                  value={productSearch}
                  onChangeText={searchProducts}
                />
              </View>
              {productResults.length > 0 && (
                <View style={styles.searchResults}>
                  {productResults.slice(0, 5).map(p => (
                    <TouchableOpacity key={p.id} style={styles.searchResultRow} onPress={() => addPoItem(p)}>
                      <Text style={styles.searchResultName}>{p.name}</Text>
                      <Text style={styles.searchResultSub}>{p.sku ?? ''} · {t('purchases.stockLabel', { count: p.stock })}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {poItems.map(item => (
                <View key={item.productId} style={styles.poItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.poItemName} numberOfLines={1}>{item.name}</Text>
                    {item.sku ? <Text style={styles.poItemSku}>{item.sku}</Text> : null}
                  </View>
                  <View style={styles.poItemFields}>
                    <View style={styles.poFieldWrap}>
                      <Text style={styles.poFieldLabel}>{t('purchases.fields.qty')}</Text>
                      <TextInput
                        style={styles.poFieldInput}
                        value={item.qtyOrdered}
                        onChangeText={v => updatePoItem(item.productId, 'qtyOrdered', v)}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.poFieldWrap}>
                      <Text style={styles.poFieldLabel}>{t('purchases.fields.cost')}</Text>
                      <TextInput
                        style={styles.poFieldInput}
                        value={item.unitCost}
                        onChangeText={v => updatePoItem(item.productId, 'unitCost', v)}
                        keyboardType="numeric"
                        placeholder="0"
                      />
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => removePoItem(item.productId)} style={{ paddingLeft: 8 }}>
                    <Ionicons name="close-circle" size={20} color="#dc2626" />
                  </TouchableOpacity>
                </View>
              ))}

              <View style={styles.field}>
                <Text style={styles.label}>{t('purchases.fields.notes')}</Text>
                <TextInput
                  style={[styles.input, { height: 72, textAlignVertical: 'top' }]}
                  value={poNotes}
                  onChangeText={setPoNotes}
                  placeholder={t('expenses.notesPlaceholder')}
                  multiline
                />
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.saveBtn} onPress={handleCreate} disabled={creating}>
              {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t('purchases.createOrder')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Receive Stock Modal */}
      <Modal visible={receiveVisible} transparent animationType="slide" onRequestClose={() => setReceiveVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('purchases.receiveStock')}</Text>
              <TouchableOpacity onPress={() => setReceiveVisible(false)}>
                <Ionicons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Text style={styles.receiveHint}>{t('purchases.receiveHint')}</Text>
            <ScrollView>
              {(selectedPO?.items ?? []).map(item => {
                const remaining = item.qty_ordered - item.qty_received;
                return (
                  <View key={item.id} style={styles.receiveItemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.poItemName}>{item.product_name}</Text>
                      <Text style={styles.poItemSku}>
                        {t('purchases.orderedReceived', {
                          ordered: item.qty_ordered,
                          received: item.qty_received,
                          remaining,
                        })}
                      </Text>
                    </View>
                    <TextInput
                      style={styles.receiveQtyInput}
                      value={receiveQtys[item.id] ?? ''}
                      onChangeText={v => setReceiveQtys(prev => ({ ...prev, [item.id]: v }))}
                      keyboardType="numeric"
                      placeholder={String(remaining)}
                      editable={remaining > 0}
                    />
                  </View>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.saveBtn} onPress={handleReceive} disabled={receiving}>
              {receiving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t('purchases.confirmReceipt')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', paddingTop: 52 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  backBtn: { padding: 4 },
  title: { flex: 1, fontSize: 20, fontWeight: '800', color: '#1a2e4a' },
  addBtn: { backgroundColor: '#1a2e4a', borderRadius: 10, padding: 8 },
  filterRow: { maxHeight: 44, marginBottom: 4 },
  filterPill: { borderWidth: 1.5, borderColor: '#d1d5db', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  filterPillActive: { borderColor: '#1a2e4a', backgroundColor: '#1a2e4a' },
  filterText: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  card: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardId: { fontSize: 14, fontWeight: '800', color: '#111827' },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  cardDate: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
  cardActions: { gap: 6, alignItems: 'flex-end' },
  receiveBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#16a34a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  receiveBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  deleteBtn: { padding: 8, backgroundColor: '#fef2f2', borderRadius: 8 },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 14 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32, maxHeight: '92%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  label: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  field: { marginBottom: 14 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: '#f9fafb' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 14 },
  searchResults: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, marginBottom: 8 },
  searchResultRow: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  searchResultName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  searchResultSub: { fontSize: 11, color: '#6b7280', marginTop: 1 },
  poItemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 8, padding: 10, marginBottom: 6 },
  poItemName: { fontSize: 13, fontWeight: '700', color: '#111827' },
  poItemSku: { fontSize: 11, color: '#6b7280', marginTop: 1 },
  poItemFields: { flexDirection: 'row', gap: 6 },
  poFieldWrap: { alignItems: 'center' },
  poFieldLabel: { fontSize: 10, color: '#9ca3af', fontWeight: '600', marginBottom: 2 },
  poFieldInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, width: 52, paddingHorizontal: 6, paddingVertical: 4, fontSize: 13, textAlign: 'center', backgroundColor: '#fff' },
  saveBtn: { backgroundColor: '#1a2e4a', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  supplierPill: { borderWidth: 1.5, borderColor: '#d1d5db', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginBottom: 12 },
  supplierPillActive: { borderColor: '#1a2e4a', backgroundColor: '#e8edf4' },
  supplierPillText: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  supplierPillTextActive: { color: '#1a2e4a' },
  receiveHint: { fontSize: 13, color: '#6b7280', marginBottom: 12 },
  receiveItemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f9fafb', borderRadius: 8, padding: 10, marginBottom: 6 },
  receiveQtyInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, width: 64, paddingHorizontal: 8, paddingVertical: 6, fontSize: 14, textAlign: 'center', backgroundColor: '#fff' },
});
