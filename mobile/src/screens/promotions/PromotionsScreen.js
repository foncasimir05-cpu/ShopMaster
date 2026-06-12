import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  Modal, StyleSheet, ActivityIndicator, Alert, ScrollView, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useShop } from '../../context/ShopContext';
import * as api from '../../services/api';

const EMPTY_FORM = { name: '', code: '', type: 'percent', value: '', min_purchase: '', expires_at: '', is_active: true };

export default function PromotionsScreen({ navigation }) {
  const { t } = useTranslation();
  const { formatCurrency } = useShop();
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getPromotions();
      setPromos(Array.isArray(data) ? data : []);
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  };

  const openEdit = (p) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      code: p.code ?? '',
      type: p.type,
      value: String(p.value),
      min_purchase: p.min_purchase > 0 ? String(p.min_purchase) : '',
      expires_at: p.expires_at ? p.expires_at.slice(0, 10) : '',
      is_active: !!p.is_active,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert(t('common.error'), t('promotions.errors.nameRequired')); return; }
    if (!form.value || isNaN(Number(form.value))) { Alert.alert(t('common.error'), t('promotions.errors.valueRequired')); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || null,
        type: form.type,
        value: Number(form.value),
        min_purchase: parseFloat(form.min_purchase) || 0,
        expires_at: form.expires_at || null,
        is_active: form.is_active,
      };
      if (editingId) {
        await api.updatePromotion(editingId, payload);
      } else {
        await api.createPromotion(payload);
      }
      setModalVisible(false);
      load();
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.error ?? err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id, name) => {
    Alert.alert(t('promotions.deleteTitle'), t('promotions.deleteMsg', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive',
        onPress: async () => {
          try { await api.deletePromotion(id); load(); }
          catch (err) { Alert.alert(t('common.error'), err.response?.data?.error ?? err.message); }
        },
      },
    ]);
  };

  const typeColor = type => type === 'percent' ? '#7c3aed' : '#1a56db';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1a2e4a" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('promotions.title')}</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1a2e4a" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={promos}
          keyExtractor={p => p.id}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => (
            <View style={[styles.card, !item.is_active && styles.cardInactive]}>
              <View style={[styles.typeBadge, { backgroundColor: typeColor(item.type) + '20' }]}>
                <Ionicons name="pricetag" size={18} color={typeColor(item.type)} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  {!item.is_active && <Text style={styles.inactiveBadge}>{t('promotions.inactive')}</Text>}
                </View>
                {item.code ? (
                  <Text style={styles.cardCode}>{item.code}</Text>
                ) : null}
                <Text style={styles.cardSub}>
                  {item.type === 'percent'
                    ? t('promotions.percentOffLabel', { value: item.value })
                    : t('promotions.flatOffLabel', { amount: formatCurrency(item.value) })}
                  {item.min_purchase > 0 ? ` · ${t('promotions.minLabel', { amount: formatCurrency(item.min_purchase) })}` : ''}
                  {item.expires_at ? ` · ${t('promotions.expiresLabel', { date: item.expires_at.slice(0, 10) })}` : ''}
                </Text>
              </View>
              <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                <Ionicons name="pencil" size={16} color="#1a2e4a" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id, item.name)}>
                <Ionicons name="trash" size={16} color="#dc2626" />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>{t('promotions.noPromosHint')}</Text>}
        />
      )}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{editingId ? t('promotions.editPromo') : t('promotions.newPromo')}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.field}>
                <Text style={styles.label}>{t('promotions.nameField')}</Text>
                <TextInput style={styles.input} value={form.name} onChangeText={v => setForm(p => ({ ...p, name: v }))} placeholder="Summer sale…" />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>{t('promotions.codeField')}</Text>
                <TextInput
                  style={styles.input}
                  value={form.code}
                  onChangeText={v => setForm(p => ({ ...p, code: v.toUpperCase() }))}
                  placeholder="SAVE10"
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>{t('promotions.discountType')}</Text>
                <View style={styles.typeRow}>
                  {['percent', 'flat'].map(tp => (
                    <TouchableOpacity
                      key={tp}
                      style={[styles.typePill, form.type === tp && styles.typePillActive]}
                      onPress={() => setForm(p => ({ ...p, type: tp }))}
                    >
                      <Text style={[styles.typePillText, form.type === tp && styles.typePillTextActive]}>
                        {tp === 'percent' ? t('promotions.percentType') : t('promotions.flatType')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>{form.type === 'percent' ? t('promotions.discountPercent') : t('promotions.discountAmountXaf')}</Text>
                <TextInput
                  style={styles.input}
                  value={form.value}
                  onChangeText={v => setForm(p => ({ ...p, value: v }))}
                  placeholder={form.type === 'percent' ? '10' : '500'}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>{t('promotions.minPurchaseXaf')}</Text>
                <TextInput
                  style={styles.input}
                  value={form.min_purchase}
                  onChangeText={v => setForm(p => ({ ...p, min_purchase: v }))}
                  placeholder={t('promotions.noMinimum')}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>{t('promotions.expires')}</Text>
                <TextInput
                  style={styles.input}
                  value={form.expires_at}
                  onChangeText={v => setForm(p => ({ ...p, expires_at: v }))}
                  placeholder="2026-12-31"
                />
              </View>

              <View style={[styles.field, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <Text style={styles.label}>{t('promotions.activeLabel')}</Text>
                <Switch
                  value={form.is_active}
                  onValueChange={v => setForm(p => ({ ...p, is_active: v }))}
                  trackColor={{ true: '#1a2e4a' }}
                />
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t('promotions.savePromo')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', paddingTop: 52 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  backBtn: { padding: 4 },
  title: { flex: 1, fontSize: 20, fontWeight: '800', color: '#1a2e4a' },
  addBtn: { backgroundColor: '#1a2e4a', borderRadius: 10, padding: 8 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardInactive: { opacity: 0.55 },
  typeBadge: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cardCode: { fontSize: 12, fontWeight: '800', color: '#7c3aed', letterSpacing: 1, marginTop: 1 },
  cardSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  inactiveBadge: { fontSize: 10, color: '#9ca3af', backgroundColor: '#f3f4f6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  editBtn: { padding: 8, backgroundColor: '#f3f4f6', borderRadius: 8 },
  deleteBtn: { padding: 8, backgroundColor: '#fef2f2', borderRadius: 8 },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 14 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32, maxHeight: '90%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  field: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: '#f9fafb' },
  typeRow: { flexDirection: 'row', gap: 8 },
  typePill: { flex: 1, borderWidth: 1.5, borderColor: '#d1d5db', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  typePillActive: { borderColor: '#1a2e4a', backgroundColor: '#e8edf4' },
  typePillText: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  typePillTextActive: { color: '#1a2e4a' },
  saveBtn: { backgroundColor: '#1a2e4a', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
