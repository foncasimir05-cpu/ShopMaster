import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Modal, ScrollView,
  StyleSheet, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as api from '../../services/api';
import { useShop } from '../../context/ShopContext';
import { printReceipt } from '../../services/receiptPrinter';

const PAGE_SIZE = 30;
const STATUS_COLOR = { completed: '#16a34a', voided: '#dc2626' };

export default function SalesHistoryScreen() {
  const { t, i18n } = useTranslation();
  const { formatCurrency } = useShop();
  const [sales, setSales] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Detail modal
  const [detailSale, setDetailSale] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = useCallback(async (p = 1, start = startDate, end = endDate, appending = false) => {
    if (!appending) setLoading(true);
    try {
      const params = { page: p, limit: PAGE_SIZE };
      if (start) params.startDate = start;
      if (end)   params.endDate   = end;
      const data = await api.getSales(params);
      const list = data.sales ?? [];
      setSales(prev => appending ? [...prev, ...list] : list);
      setTotalCount(data.total_count ?? 0);
      setPage(p);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [startDate, endDate]);

  const applyFilter = () => { setSales([]); load(1, startDate, endDate); };
  const onRefresh = () => { setRefreshing(true); load(1, startDate, endDate); };
  const onEndReached = () => {
    if (loading || sales.length >= totalCount) return;
    load(page + 1, startDate, endDate, true);
  };

  const openDetail = async (sale) => {
    setDetailSale(sale);
    setLoadingDetail(true);
    try {
      const data = await api.getSale(sale.id);
      setDetailSale({ ...sale, ...data });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error ?? err.message);
      setDetailSale(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleVoid = sale => {
    Alert.alert(
      t('sales.detail.void'),
      t('sales.detail.voidConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('sales.detail.void'), style: 'destructive',
          onPress: async () => {
            try {
              await api.voidSale(sale.id);
              load(1, startDate, endDate);
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error ?? err.message);
            }
          },
        },
      ]
    );
  };

  const handlePrint = async () => {
    if (!detailSale?.items) return;
    let shop = null;
    try { shop = await api.getSettings(); } catch {}
    await printReceipt({ shop, sale: detailSale, items: detailSale.items ?? [] });
  };

  const handleSendEmail = () => {
    const defaultEmail = detailSale?.customer_email ?? '';
    Alert.prompt(
      'Send Receipt',
      'Enter customer email address:',
      async (email) => {
        if (!email?.trim()) return;
        try {
          await api.sendReceiptEmail(detailSale.id, email.trim());
          Alert.alert('Sent', `Receipt emailed to ${email.trim()}`);
        } catch (err) {
          Alert.alert('Failed', err.response?.data?.error ?? err.message);
        }
      },
      'plain-text',
      defaultEmail
    );
  };

  const hasLoaded = sales.length > 0 || (!loading && page >= 1);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('sales.title')}</Text>

      <View style={styles.filterRow}>
        <TextInput
          style={styles.dateInput}
          placeholder={t('sales.from')}
          value={startDate}
          onChangeText={setStartDate}
        />
        <TextInput
          style={styles.dateInput}
          placeholder={t('sales.to')}
          value={endDate}
          onChangeText={setEndDate}
        />
        <TouchableOpacity style={styles.filterBtn} onPress={applyFilter}>
          <Text style={styles.filterBtnText}>{t('sales.filter')}</Text>
        </TouchableOpacity>
      </View>

      {totalCount > 0 && (
        <Text style={styles.countLabel}>{t('sales.countLabel', { count: totalCount })}</Text>
      )}

      {loading && sales.length === 0 ? (
        <ActivityIndicator size="large" color="#1a56db" style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={sales}
          keyExtractor={s => s.id}
          onRefresh={onRefresh}
          refreshing={refreshing}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            hasLoaded
              ? <Text style={styles.empty}>{t('sales.noSales')}</Text>
              : null
          }
          ListFooterComponent={
            loading && sales.length > 0
              ? <ActivityIndicator size="small" color="#1a56db" style={{ marginVertical: 12 }} />
              : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => openDetail(item)} activeOpacity={0.7}>
              <View style={styles.rowLeft}>
                <Text style={styles.saleId}>#{item.id.slice(0, 8).toUpperCase()}</Text>
                <Text style={styles.saleDate}>{new Date(item.created_at).toLocaleString(i18n.language)}</Text>
                <Text style={styles.cashier}>{item.cashier_email}</Text>
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, { backgroundColor: STATUS_COLOR[item.status] ?? '#6b7280' }]}>
                    <Text style={styles.badgeText}>{item.status}</Text>
                  </View>
                  {item.payment_method && (
                    <Text style={styles.payMethod}>{item.payment_method.replace('_', ' ')}</Text>
                  )}
                </View>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.saleTotal}>{formatCurrency(item.total)}</Text>
                <Ionicons name="chevron-forward" size={14} color="#9ca3af" style={{ marginTop: 4 }} />
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Detail Modal */}
      <Modal
        visible={!!detailSale}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailSale(null)}
      >
        <View style={styles.detailOverlay}>
          <View style={styles.detailCard}>
            {/* Header */}
            <View style={styles.detailHeader}>
              <View>
                <Text style={styles.detailRef}>#{detailSale?.id?.slice(0, 8).toUpperCase()}</Text>
                <Text style={styles.detailDate}>
                  {detailSale && new Date(detailSale.created_at).toLocaleString(i18n.language)}
                </Text>
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, { backgroundColor: STATUS_COLOR[detailSale?.status] ?? '#6b7280' }]}>
                    <Text style={styles.badgeText}>{detailSale?.status}</Text>
                  </View>
                  <Text style={styles.payMethod}>
                    {detailSale?.payment_method?.replace('_', ' ')}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setDetailSale(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {loadingDetail ? (
              <ActivityIndicator size="large" color="#1a56db" style={{ padding: 32 }} />
            ) : (
              <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
                {/* Items */}
                {(detailSale?.items ?? []).map(item => (
                  <View key={item.id} style={styles.detailItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailItemName}>{item.product_name}</Text>
                      <Text style={styles.detailItemSub}>
                        {item.quantity} x {formatCurrency(item.unit_price)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.detailItemTotal}>{formatCurrency(item.subtotal)}</Text>
                      {item.cost_price > 0 && (
                        <Text style={styles.detailItemProfit}>
                          +{formatCurrency(item.item_profit ?? (item.unit_price - item.cost_price) * item.quantity)}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}

                {/* Totals */}
                <View style={styles.detailTotals}>
                  {(detailSale?.discount ?? 0) > 0 && (
                    <View style={styles.totRow}>
                      <Text style={styles.totLabel}>{t('sales.detail.discount')}</Text>
                      <Text style={styles.totValue}>-{formatCurrency(detailSale.discount)}</Text>
                    </View>
                  )}
                  {(detailSale?.tax ?? 0) > 0 && (
                    <View style={styles.totRow}>
                      <Text style={styles.totLabel}>{t('sales.detail.tax')}</Text>
                      <Text style={styles.totValue}>{formatCurrency(detailSale.tax)}</Text>
                    </View>
                  )}
                  <View style={[styles.totRow, { marginTop: 4 }]}>
                    <Text style={[styles.totLabel, { fontWeight: '700', fontSize: 15 }]}>{t('sales.detail.total')}</Text>
                    <Text style={[styles.totValue, { fontWeight: '900', fontSize: 16, color: '#111827' }]}>
                      {formatCurrency(detailSale?.total)}
                    </Text>
                  </View>
                  {detailSale?.total_profit !== undefined && (
                    <View style={styles.totRow}>
                      <Text style={styles.totLabel}>{t('sales.detail.grossProfit')}</Text>
                      <Text style={[styles.totValue, { color: '#16a34a', fontWeight: '700' }]}>
                        {formatCurrency(detailSale.total_profit)}
                      </Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            )}

            {/* Actions */}
            {!loadingDetail && (
              <View style={styles.detailActions}>
                {detailSale?.status === 'completed' && (
                  <TouchableOpacity style={styles.printBtn} onPress={handlePrint}>
                    <Ionicons name="print-outline" size={15} color="#fff" />
                    <Text style={styles.printBtnText}>{t('common.print')}</Text>
                  </TouchableOpacity>
                )}
                {detailSale?.status === 'completed' && (
                  <TouchableOpacity style={styles.emailBtn} onPress={handleSendEmail}>
                    <Ionicons name="mail-outline" size={15} color="#fff" />
                    <Text style={styles.printBtnText}>{t('common.email')}</Text>
                  </TouchableOpacity>
                )}
                {detailSale?.status === 'completed' && (
                  <TouchableOpacity
                    style={styles.voidBtn}
                    onPress={() => { const s = detailSale; setDetailSale(null); handleVoid(s); }}
                  >
                    <Text style={styles.voidBtnText}>{t('sales.detail.void')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 16, paddingTop: 52 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 12 },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  dateInput: {
    flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12,
  },
  filterBtn: {
    backgroundColor: '#1a56db', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8, justifyContent: 'center',
  },
  filterBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  countLabel: { fontSize: 12, color: '#6b7280', marginBottom: 8 },

  row: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 10,
    padding: 14, marginBottom: 8,
  },
  rowLeft: { flex: 1 },
  rowRight: { alignItems: 'flex-end', justifyContent: 'center' },
  saleId: { fontSize: 15, fontWeight: '700', color: '#111827' },
  saleDate: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  cashier: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  payMethod: { fontSize: 11, color: '#6b7280', textTransform: 'capitalize' },
  saleTotal: { fontSize: 17, fontWeight: '800', color: '#0e9f6e' },

  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 48, lineHeight: 22 },

  // Detail modal
  detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  detailCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 32, maxHeight: '85%',
  },
  detailHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 16,
  },
  detailRef: { fontSize: 18, fontWeight: '800', color: '#111827' },
  detailDate: { fontSize: 12, color: '#6b7280', marginTop: 2, marginBottom: 6 },
  detailScroll: { maxHeight: 340 },

  detailItem: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  detailItemName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  detailItemSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  detailItemTotal: { fontSize: 14, fontWeight: '700', color: '#111827' },
  detailItemProfit: { fontSize: 11, color: '#16a34a', fontWeight: '600', marginTop: 2 },

  detailTotals: { paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 4 },
  totRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totLabel: { fontSize: 13, color: '#6b7280' },
  totValue: { fontSize: 13, color: '#111827' },

  detailActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  printBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#1a2e4a', borderRadius: 10, paddingVertical: 12,
  },
  printBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  emailBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#1a56db', borderRadius: 10, paddingVertical: 12,
  },
  voidBtn: {
    borderWidth: 1.5, borderColor: '#fca5a5', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 16, justifyContent: 'center',
  },
  voidBtnText: { color: '#dc2626', fontSize: 13, fontWeight: '700' },
});
