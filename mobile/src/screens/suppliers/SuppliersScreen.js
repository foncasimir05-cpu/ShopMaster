import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  Modal, StyleSheet, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as api from '../../services/api';

const EMPTY_FORM = { name: '', contact: '', phone: '', email: '', address: '' };

export default function SuppliersScreen({ navigation }) {
  const { t } = useTranslation();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (q = '') => {
    setLoading(true);
    try {
      const data = await api.getSuppliers(q ? { search: q } : {});
      setSuppliers(Array.isArray(data) ? data : []);
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

  const openEdit = (s) => {
    setEditingId(s.id);
    setForm({ name: s.name, contact: s.contact ?? '', phone: s.phone ?? '', email: s.email ?? '', address: s.address ?? '' });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert(t('common.error'), t('suppliers.errors.nameRequired')); return; }
    setSaving(true);
    try {
      if (editingId) {
        await api.updateSupplier(editingId, form);
      } else {
        await api.createSupplier(form);
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
    Alert.alert(t('suppliers.deleteTitle'), t('suppliers.deleteMsg', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteSupplier(id);
            load();
          } catch (err) {
            Alert.alert(t('common.error'), err.response?.data?.error ?? err.message);
          }
        },
      },
    ]);
  };

  const FIELDS = [
    { key: 'name', labelKey: 'suppliers.fields.name', placeholder: 'Supplier name' },
    { key: 'contact', labelKey: 'suppliers.fields.contact', placeholder: 'Contact name' },
    { key: 'phone', labelKey: 'suppliers.fields.phone', placeholder: '+237…', keyboardType: 'phone-pad' },
    { key: 'email', labelKey: 'suppliers.fields.email', placeholder: 'email@example.com', keyboardType: 'email-address' },
    { key: 'address', labelKey: 'suppliers.fields.address', placeholder: 'Street, city…' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1a2e4a" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('suppliers.title')}</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          placeholder={t('suppliers.searchPlaceholder')}
          value={search}
          onChangeText={q => { setSearch(q); load(q); }}
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1a2e4a" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={suppliers}
          keyExtractor={s => s.id}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardAvatar}>
                <Text style={styles.cardAvatarText}>{item.name[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{item.name}</Text>
                {item.contact ? <Text style={styles.cardSub}>{item.contact}</Text> : null}
                {item.phone ? <Text style={styles.cardSub}>{item.phone}</Text> : null}
              </View>
              <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                <Ionicons name="pencil" size={16} color="#1a2e4a" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id, item.name)}>
                <Ionicons name="trash" size={16} color="#dc2626" />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>{t('suppliers.noSuppliersHint')}</Text>}
        />
      )}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{editingId ? t('suppliers.editSupplier') : t('suppliers.newSupplier')}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {FIELDS.map(f => (
                <View key={f.key} style={styles.field}>
                  <Text style={styles.label}>{t(f.labelKey)}</Text>
                  <TextInput
                    style={styles.input}
                    value={form[f.key]}
                    onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
                    placeholder={f.placeholder}
                    keyboardType={f.keyboardType}
                  />
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t('suppliers.saveSupplier')}</Text>}
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
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 12, marginBottom: 8,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 14 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  cardAvatarText: { fontSize: 18, fontWeight: '800', color: '#1a56db' },
  cardName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cardSub: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  editBtn: { padding: 8, backgroundColor: '#f3f4f6', borderRadius: 8 },
  deleteBtn: { padding: 8, backgroundColor: '#fef2f2', borderRadius: 8 },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 14 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32, maxHeight: '85%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  field: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: '#f9fafb' },
  saveBtn: { backgroundColor: '#1a2e4a', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
