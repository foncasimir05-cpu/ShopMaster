import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import * as api from '../../services/api';
import { formatCurrency } from 'shopmaster-shared';

const PAGE_SIZE = 30;

const STATUS_COLOR = { completed: '#16a34a', voided: '#dc2626' };

export default function SalesHistoryScreen() {
  const [sales, setSales] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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

  const handleVoid = sale => {
    Alert.alert(
      'Void Sale',
      `Void sale #${sale.id.slice(0, 8).toUpperCase()}? Stock will be restored.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Void',
          style: 'destructive',
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

  const hasLoaded = sales.length > 0 || (!loading && page >= 1);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sales History</Text>

      <View style={styles.filterRow}>
        <TextInput
          style={styles.dateInput}
          placeholder="Start YYYY-MM-DD"
          value={startDate}
          onChangeText={setStartDate}
        />
        <TextInput
          style={styles.dateInput}
          placeholder="End YYYY-MM-DD"
          value={endDate}
          onChangeText={setEndDate}
        />
        <TouchableOpacity style={styles.filterBtn} onPress={applyFilter}>
          <Text style={styles.filterBtnText}>Filter</Text>
        </TouchableOpacity>
      </View>

      {totalCount > 0 && (
        <Text style={styles.countLabel}>{totalCount} sales</Text>
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
            hasLoaded ? (
              <Text style={styles.empty}>No sales found.{'\n'}Tap Filter or pull to refresh.</Text>
            ) : null
          }
          ListFooterComponent={
            loading && sales.length > 0
              ? <ActivityIndicator size="small" color="#1a56db" style={{ marginVertical: 12 }} />
              : null
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.saleId}>#{item.id.slice(0, 8).toUpperCase()}</Text>
                <Text style={styles.saleDate}>{new Date(item.created_at).toLocaleString()}</Text>
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
                {item.status === 'completed' && (
                  <TouchableOpacity style={styles.voidBtn} onPress={() => handleVoid(item)}>
                    <Text style={styles.voidBtnText}>Void</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        />
      )}
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
  rowRight: { alignItems: 'flex-end', justifyContent: 'space-between' },
  saleId: { fontSize: 15, fontWeight: '700', color: '#111827' },
  saleDate: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  cashier: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  payMethod: { fontSize: 11, color: '#6b7280', textTransform: 'capitalize' },
  saleTotal: { fontSize: 17, fontWeight: '800', color: '#0e9f6e' },
  voidBtn: {
    marginTop: 8, borderWidth: 1, borderColor: '#fca5a5',
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4,
  },
  voidBtnText: { color: '#dc2626', fontSize: 12, fontWeight: '600' },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 48, lineHeight: 22 },
});
