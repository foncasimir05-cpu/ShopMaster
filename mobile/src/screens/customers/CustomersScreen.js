import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, ScrollView, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useShop } from '../../context/ShopContext';
import * as api from '../../services/api';

export default function CustomersScreen() {
  const { t, i18n } = useTranslation();
  const { formatCurrency } = useShop();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState(null);
  const [editCustomer, setEditCustomer] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [saving, setSaving] = useState(false);

  const fetchCustomers = useCallback(async (q = search) => {
    setLoading(true);
    try {
      const data = await api.getCustomers({ search: q, limit: 60 });
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const openAdd = () => {
    setEditCustomer(null);
    setForm({ name: '', phone: '', email: '' });
    setFormVisible(true);
  };

  const openEdit = (c) => {
    setEditCustomer(c);
    setForm({ name: c.name, phone: c.phone ?? '', email: c.email ?? '' });
    setDetailCustomer(null);
    setFormVisible(true);
  };

  const openDetail = async (c) => {
    try {
      const data = await api.getCustomer(c.id);
      setDetailCustomer(data);
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.error ?? err.message);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert(t('common.error'), t('customers.errors.nameRequired')); return; }
    setSaving(true);
    try {
      if (editCustomer) {
        await api.updateCustomer(editCustomer.id, form);
      } else {
        await api.createCustomer(form);
      }
      setFormVisible(false);
      fetchCustomers('');
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.error ?? err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSearch = (text) => {
    setSearch(text);
    fetchCustomers(text);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>{t('customers.title')}</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Ionicons name="person-add" size={16} color="#fff" />
          <Text style={styles.addBtnText}>{t('customers.add')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color="#9ca3af" style={{ marginRight: 6 }} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('customers.searchPlaceholder')}
          value={search}
          onChangeText={handleSearch}
        />
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#1a56db" />
      ) : (
        <FlatList
          data={customers}
          keyExtractor={c => c.id}
          contentContainerStyle={{ padding: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCustomers(''); }} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.customerCard} onPress={() => openDetail(item)} activeOpacity={0.7}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name[0].toUpperCase()}</Text>
              </View>
              <View style={styles.customerInfo}>
                <Text style={styles.customerName}>{item.name}</Text>
                {item.phone ? <Text style={styles.customerSub}>{item.phone}</Text> : null}
                <View style={styles.customerStats}>
                  <View style={styles.statPill}>
                    <Ionicons name="star" size={10} color="#d97706" />
                    <Text style={styles.statText}>{item.loyalty_points} {t('customers.pts')}</Text>
                  </View>
                  <View style={styles.statPill}>
                    <Ionicons name="cart" size={10} color="#1a56db" />
                    <Text style={styles.statText}>{item.visit_count} {t('customers.visits')}</Text>
                  </View>
                  <Text style={styles.statSpent}>{formatCurrency(item.total_spent)}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Ionicons name="people-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>{t('customers.noCustomersYet')}</Text>
              <Text style={styles.emptySubText}>{t('customers.addFirstCustomer')}</Text>
            </View>
          }
        />
      )}

      {/* Add / Edit Form Modal */}
      <Modal visible={formVisible} animationType="slide" transparent onRequestClose={() => setFormVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editCustomer ? t('customers.editCustomer') : t('customers.newCustomer')}</Text>

            <Text style={styles.fieldLabel}>{t('customers.fullNameField')}</Text>
            <TextInput
              style={styles.fieldInput}
              value={form.name}
              onChangeText={v => setForm(f => ({ ...f, name: v }))}
              placeholder="e.g. Jean-Pierre"
              autoFocus
            />

            <Text style={styles.fieldLabel}>{t('common.phone')}</Text>
            <TextInput
              style={styles.fieldInput}
              value={form.phone}
              onChangeText={v => setForm(f => ({ ...f, phone: v }))}
              placeholder="+237 6XX XXX XXX"
              keyboardType="phone-pad"
            />

            <Text style={styles.fieldLabel}>{t('common.email')}</Text>
            <TextInput
              style={styles.fieldInput}
              value={form.email}
              onChangeText={v => setForm(f => ({ ...f, email: v }))}
              placeholder="customer@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setFormVisible(false)} disabled={saving}>
                <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.saveBtnText}>{editCustomer ? t('customers.update') : t('customers.create')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Customer Detail Modal */}
      <Modal visible={!!detailCustomer} animationType="slide" transparent onRequestClose={() => setDetailCustomer(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            {detailCustomer && (
              <>
                <View style={styles.detailHeader}>
                  <View style={[styles.avatar, styles.avatarLarge]}>
                    <Text style={[styles.avatarText, { fontSize: 22 }]}>{detailCustomer.name[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailName}>{detailCustomer.name}</Text>
                    {detailCustomer.phone ? <Text style={styles.detailSub}>{detailCustomer.phone}</Text> : null}
                    {detailCustomer.email ? <Text style={styles.detailSub}>{detailCustomer.email}</Text> : null}
                  </View>
                  <TouchableOpacity onPress={() => openEdit(detailCustomer)} style={styles.editIcon}>
                    <Ionicons name="pencil" size={16} color="#1a56db" />
                  </TouchableOpacity>
                </View>

                <View style={styles.statsRow}>
                  <StatBox icon="star" label={t('customers.loyaltyPoints')} value={detailCustomer.loyalty_points} color="#d97706" />
                  <StatBox icon="cart" label={t('customers.visits')} value={detailCustomer.visit_count} color="#1a56db" />
                  <StatBox icon="cash" label={t('customers.totalSpent')} value={formatCurrency(detailCustomer.total_spent)} color="#16a34a" />
                </View>

                <Text style={styles.sectionLabel}>{t('customers.recentPurchases')}</Text>
                <ScrollView style={{ maxHeight: 260 }}>
                  {detailCustomer.recentSales?.length === 0
                    ? <Text style={styles.emptyText}>{t('customers.noPurchases')}</Text>
                    : detailCustomer.recentSales?.map(s => (
                      <View key={s.id} style={styles.saleRow}>
                        <View>
                          <Text style={styles.saleId}>#{s.id.slice(0, 8).toUpperCase()}</Text>
                          <Text style={styles.saleDate}>{new Date(s.created_at).toLocaleDateString(i18n.language)}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.saleTotal}>{formatCurrency(s.total)}</Text>
                          <Text style={styles.saleMethod}>{s.payment_method}</Text>
                        </View>
                      </View>
                    ))
                  }
                </ScrollView>

                <TouchableOpacity style={styles.closeBtn} onPress={() => setDetailCustomer(null)}>
                  <Text style={styles.closeBtnText}>{t('common.close')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StatBox({ icon, label, value, color }) {
  return (
    <View style={styles.statBox}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.statBoxValue, { color }]}>{value}</Text>
      <Text style={styles.statBoxLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', paddingTop: 52 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10,
  },
  heading: { fontSize: 24, fontWeight: '900', color: '#111827' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1a56db', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 8,
    borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb',
    paddingHorizontal: 12, paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },

  customerCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center',
  },
  avatarLarge: { width: 56, height: 56, borderRadius: 28 },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#1a56db' },
  customerInfo: { flex: 1 },
  customerName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  customerSub: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  customerStats: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  statPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  statText: { fontSize: 10, color: '#374151', fontWeight: '600' },
  statSpent: { fontSize: 11, color: '#1a56db', fontWeight: '700' },

  emptyText: { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginTop: 8 },
  emptySubText: { fontSize: 12, color: '#d1d5db', textAlign: 'center', marginTop: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 18 },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 5, marginTop: 10 },
  fieldInput: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827',
  },

  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { color: '#374151', fontWeight: '600' },
  saveBtn: { flex: 2, backgroundColor: '#1a56db', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  detailName: { fontSize: 18, fontWeight: '800', color: '#111827' },
  detailSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  editIcon: { padding: 8, backgroundColor: '#eff6ff', borderRadius: 8 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statBox: {
    flex: 1, backgroundColor: '#f9fafb', borderRadius: 12, padding: 12, alignItems: 'center', gap: 4,
  },
  statBoxValue: { fontSize: 16, fontWeight: '900' },
  statBoxLabel: { fontSize: 10, color: '#9ca3af', fontWeight: '600' },

  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },

  saleRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  saleId: { fontSize: 13, fontWeight: '700', color: '#111827' },
  saleDate: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  saleTotal: { fontSize: 14, fontWeight: '800', color: '#1a56db' },
  saleMethod: { fontSize: 11, color: '#6b7280', marginTop: 2, textTransform: 'capitalize' },

  closeBtn: { marginTop: 16, backgroundColor: '#f3f4f6', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  closeBtnText: { color: '#374151', fontWeight: '700', fontSize: 15 },
});
