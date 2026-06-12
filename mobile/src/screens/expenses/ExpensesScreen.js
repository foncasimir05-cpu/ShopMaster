import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  Modal, StyleSheet, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useShop } from '../../context/ShopContext';
import * as api from '../../services/api';

const CATEGORY_KEYS = ['Rent', 'Salaries', 'Utilities', 'Supplies', 'Transport', 'Marketing', 'Equipment', 'Other'];

const CAT_ICONS = {
  Rent: 'home-outline',
  Salaries: 'people-outline',
  Utilities: 'flash-outline',
  Supplies: 'cube-outline',
  Transport: 'car-outline',
  Marketing: 'megaphone-outline',
  Equipment: 'hardware-chip-outline',
  Other: 'ellipsis-horizontal-outline',
};

const CAT_COLORS = {
  Rent: '#7c3aed', Salaries: '#1a56db', Utilities: '#d97706',
  Supplies: '#16a34a', Transport: '#0891b2', Marketing: '#db2777',
  Equipment: '#6b7280', Other: '#9ca3af',
};

const today = () => new Date().toISOString().split('T')[0];

const EMPTY_FORM = { amount: '', category: 'Other', description: '', date: today() };

export default function ExpensesScreen({ navigation }) {
  const { t } = useTranslation();
  const { formatCurrency } = useShop();
  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [catFilter, setCatFilter] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [summaryVisible, setSummaryVisible] = useState(false);
  const [summary, setSummary] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (catFilter) params.category = catFilter;
      const data = await api.getExpenses(params);
      setExpenses(data.expenses ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, catFilter]);

  useEffect(() => { load(); }, [load]);

  const loadSummary = async () => {
    try {
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const data = await api.getExpensesSummary(params);
      setSummary(data);
      setSummaryVisible(true);
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.error ?? err.message);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  };

  const openEdit = (e) => {
    setEditingId(e.id);
    setForm({ amount: String(e.amount), category: e.category, description: e.description ?? '', date: e.date });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.amount || isNaN(Number(form.amount))) { Alert.alert(t('common.error'), t('expenses.validAmount')); return; }
    if (!form.date) { Alert.alert(t('common.error'), t('expenses.fields.date') + ' ' + t('common.required').toLowerCase()); return; }
    setSaving(true);
    try {
      if (editingId) {
        await api.updateExpense(editingId, form);
      } else {
        await api.createExpense(form);
      }
      setModalVisible(false);
      load();
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.error ?? err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id, desc) => {
    Alert.alert(t('expenses.deleteExpense'), t('expenses.deleteConfirmMsg', { desc: desc || t('expenses.title') }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive',
        onPress: async () => {
          try { await api.deleteExpense(id); load(); }
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
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('expenses.title')}</Text>
          {total > 0 && <Text style={styles.totalLine}>{t('expenses.totalLabel', { amount: formatCurrency(total) })}</Text>}
        </View>
        <TouchableOpacity style={styles.summaryBtn} onPress={loadSummary}>
          <Ionicons name="pie-chart-outline" size={18} color="#1a2e4a" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        <TextInput style={styles.dateInput} placeholder="From YYYY-MM-DD" value={startDate} onChangeText={setStartDate} />
        <TextInput style={styles.dateInput} placeholder="To YYYY-MM-DD" value={endDate} onChangeText={setEndDate} />
        <TouchableOpacity style={styles.filterBtn} onPress={load}>
          <Text style={styles.filterBtnText}>{t('expenses.filter')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRow} contentContainerStyle={{ gap: 6, paddingHorizontal: 12 }}>
        <TouchableOpacity
          style={[styles.catPill, !catFilter && styles.catPillActive]}
          onPress={() => setCatFilter('')}
        >
          <Text style={[styles.catText, !catFilter && styles.catTextActive]}>{t('expenses.all')}</Text>
        </TouchableOpacity>
        {CATEGORY_KEYS.map(c => (
          <TouchableOpacity
            key={c}
            style={[styles.catPill, catFilter === c && styles.catPillActive]}
            onPress={() => setCatFilter(c)}
          >
            <Text style={[styles.catText, catFilter === c && styles.catTextActive]}>{t(`expenses.categories.${c}`)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color="#1a2e4a" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={e => e.id}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={[styles.catIcon, { backgroundColor: (CAT_COLORS[item.category] ?? '#6b7280') + '20' }]}>
                <Ionicons name={CAT_ICONS[item.category] ?? 'ellipsis-horizontal-outline'} size={18} color={CAT_COLORS[item.category] ?? '#6b7280'} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.cardCat}>{t(`expenses.categories.${item.category}`, { defaultValue: item.category })}</Text>
                  <Text style={styles.cardDate}>{item.date}</Text>
                </View>
                {item.description ? <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text> : null}
              </View>
              <Text style={styles.cardAmount}>{formatCurrency(item.amount)}</Text>
              <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                <Ionicons name="pencil" size={15} color="#1a2e4a" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id, item.description)}>
                <Ionicons name="trash" size={15} color="#dc2626" />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>{t('expenses.noExpensesHint')}</Text>}
        />
      )}

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{editingId ? t('expenses.editExpense') : t('expenses.newExpense')}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>{t('expenses.amountXaf')}</Text>
              <TextInput
                style={styles.input}
                value={form.amount}
                onChangeText={v => setForm(p => ({ ...p, amount: v }))}
                keyboardType="numeric"
                placeholder="e.g. 50000"
                autoFocus
              />

              <Text style={styles.label}>{t('expenses.fields.category')}</Text>
              <View style={styles.catGrid}>
                {CATEGORY_KEYS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.catGridItem, form.category === c && { borderColor: CAT_COLORS[c], backgroundColor: CAT_COLORS[c] + '15' }]}
                    onPress={() => setForm(p => ({ ...p, category: c }))}
                  >
                    <Ionicons name={CAT_ICONS[c]} size={16} color={form.category === c ? CAT_COLORS[c] : '#9ca3af'} />
                    <Text style={[styles.catGridText, form.category === c && { color: CAT_COLORS[c] }]}>{t(`expenses.categories.${c}`)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>{t('expenses.fields.description')}</Text>
              <TextInput
                style={styles.input}
                value={form.description}
                onChangeText={v => setForm(p => ({ ...p, description: v }))}
                placeholder={t('expenses.notesPlaceholder')}
              />

              <Text style={styles.label}>{t('expenses.fields.date')}</Text>
              <TextInput
                style={styles.input}
                value={form.date}
                onChangeText={v => setForm(p => ({ ...p, date: v }))}
                placeholder="YYYY-MM-DD"
              />
            </ScrollView>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t('expenses.saveExpense')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Summary Modal */}
      <Modal visible={summaryVisible} transparent animationType="fade" onRequestClose={() => setSummaryVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('expenses.summary')}</Text>
              <TouchableOpacity onPress={() => setSummaryVisible(false)}>
                <Ionicons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Text style={styles.summaryTotal}>{t('expenses.totalLabel', { amount: formatCurrency(summary?.total ?? 0) })}</Text>
            {(summary?.byCategory ?? []).map(row => {
              const pct = summary?.total > 0 ? Math.round((row.total / summary.total) * 100) : 0;
              return (
                <View key={row.category} style={styles.summaryRow}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={[styles.sumDot, { backgroundColor: CAT_COLORS[row.category] ?? '#9ca3af' }]} />
                      <Text style={styles.sumLabel}>{t(`expenses.categories.${row.category}`, { defaultValue: row.category })}</Text>
                    </View>
                    <Text style={styles.sumValue}>{formatCurrency(row.total)} <Text style={styles.sumPct}>({pct}%)</Text></Text>
                  </View>
                  <View style={styles.sumBarBg}>
                    <View style={[styles.sumBar, { width: `${pct}%`, backgroundColor: CAT_COLORS[row.category] ?? '#9ca3af' }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', paddingTop: 52 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontWeight: '800', color: '#1a2e4a' },
  totalLine: { fontSize: 12, color: '#dc2626', fontWeight: '700' },
  summaryBtn: { padding: 8, borderRadius: 10, backgroundColor: '#f3f4f6' },
  addBtn: { backgroundColor: '#1a2e4a', borderRadius: 10, padding: 8 },
  filterRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, marginBottom: 6 },
  dateInput: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontSize: 12, backgroundColor: '#fff' },
  filterBtn: { backgroundColor: '#1a2e4a', borderRadius: 8, paddingHorizontal: 12, justifyContent: 'center' },
  filterBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  catRow: { maxHeight: 40, marginBottom: 6 },
  catPill: { borderWidth: 1.5, borderColor: '#d1d5db', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5 },
  catPillActive: { borderColor: '#1a2e4a', backgroundColor: '#1a2e4a' },
  catText: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  catTextActive: { color: '#fff' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  catIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  cardCat: { fontSize: 13, fontWeight: '700', color: '#111827' },
  cardDate: { fontSize: 11, color: '#9ca3af' },
  cardDesc: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  cardAmount: { fontSize: 15, fontWeight: '800', color: '#dc2626' },
  editBtn: { padding: 7, backgroundColor: '#f3f4f6', borderRadius: 8 },
  deleteBtn: { padding: 7, backgroundColor: '#fef2f2', borderRadius: 8 },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 14 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32, maxHeight: '90%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  label: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: '#f9fafb' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  catGridItem: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  catGridText: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  saveBtn: { backgroundColor: '#1a2e4a', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  summaryTotal: { fontSize: 18, fontWeight: '900', color: '#dc2626', marginBottom: 16, textAlign: 'center' },
  summaryRow: { marginBottom: 12 },
  sumDot: { width: 10, height: 10, borderRadius: 5 },
  sumLabel: { fontSize: 14, color: '#374151', fontWeight: '600' },
  sumValue: { fontSize: 13, fontWeight: '700', color: '#111827' },
  sumPct: { fontSize: 11, color: '#9ca3af', fontWeight: '400' },
  sumBarBg: { height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, overflow: 'hidden' },
  sumBar: { height: 6, borderRadius: 3 },
});
