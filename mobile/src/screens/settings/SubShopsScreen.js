import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getSubShops, createSubShop, switchToSubShopApi } from '../../services/api';

export default function SubShopsScreen() {
  const navigation = useNavigation();
  const { switchToSubShop, user } = useAuth();

  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const [branchName, setBranchName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    getSubShops()
      .then(d => setBranches(d.subShops ?? []))
      .catch(() => setError('Failed to load branches'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!branchName.trim() || !adminName.trim() || !adminEmail.trim() || !adminPassword) {
      setError('All fields are required');
      return;
    }
    setCreating(true);
    setError('');
    try {
      await createSubShop({ branchName: branchName.trim(), adminName: adminName.trim(), adminEmail, adminPassword });
      setBranchName(''); setAdminName(''); setAdminEmail(''); setAdminPassword('');
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to create branch');
    } finally {
      setCreating(false);
    }
  };

  const handleAccess = async (branch) => {
    Alert.alert(
      `Access ${branch.name}?`,
      `You will switch into ${branch.name} as admin. Use "Back to ${user?.shopName}" to return.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Access Branch',
          onPress: async () => {
            try {
              const data = await switchToSubShopApi(branch.id);
              await switchToSubShop(data);
              navigation.navigate('Home');
            } catch {
              Alert.alert('Error', 'Could not access branch. Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color="#1a2e4a" />
        </TouchableOpacity>
        <Text style={styles.heading}>Manage Branches</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1a2e4a" style={{ marginTop: 40 }} />
      ) : (
        <>
          {branches.length === 0 && !showForm && (
            <View style={styles.emptyBox}>
              <Ionicons name="storefront-outline" size={40} color="#9ca3af" />
              <Text style={styles.emptyText}>No branches yet</Text>
              <Text style={styles.emptyHint}>Create your first branch below</Text>
            </View>
          )}

          {branches.map(branch => (
            <View key={branch.id} style={styles.card}>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{branch.name}</Text>
                <Text style={styles.cardMeta}>{branch.staff_count} active staff</Text>
              </View>
              <TouchableOpacity style={styles.accessBtn} onPress={() => handleAccess(branch)}>
                <Text style={styles.accessBtnText}>Access</Text>
              </TouchableOpacity>
            </View>
          ))}

          {!showForm && (
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
              <Ionicons name="add-circle-outline" size={20} color="#1a2e4a" />
              <Text style={styles.addBtnText}>Add Branch</Text>
            </TouchableOpacity>
          )}

          {showForm && (
            <View style={styles.form}>
              <Text style={styles.formTitle}>New Branch</Text>
              <Field label="Branch Name" value={branchName} onChangeText={setBranchName} placeholder="e.g. Downtown Branch" />
              <Field label="Admin Name" value={adminName} onChangeText={setAdminName} placeholder="Branch manager name" />
              <Field label="Admin Email" value={adminEmail} onChangeText={setAdminEmail} keyboardType="email-address" autoCapitalize="none" placeholder="admin@branch.com" />
              <Field label="Admin Password" value={adminPassword} onChangeText={setAdminPassword} secureTextEntry placeholder="Min 8 characters" />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <View style={styles.formActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowForm(false); setError(''); }}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.createBtn, creating && styles.disabledBtn]}
                  onPress={handleCreate}
                  disabled={creating}
                >
                  <Text style={styles.createBtnText}>{creating ? 'Creating…' : 'Create Branch'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function Field({ label, ...props }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 24, paddingTop: 56, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 12 },
  back: { padding: 4 },
  heading: { fontSize: 22, fontWeight: '800', color: '#111827' },
  emptyBox: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#6b7280' },
  emptyHint: { fontSize: 13, color: '#9ca3af' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cardMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  accessBtn: { backgroundColor: '#1a2e4a', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  accessBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#eff6ff', borderRadius: 10, padding: 16, justifyContent: 'center', marginTop: 8 },
  addBtnText: { color: '#1a2e4a', fontWeight: '700', fontSize: 15 },
  form: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 8, gap: 12 },
  formTitle: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 4 },
  fieldWrap: { gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { color: '#374151', fontWeight: '700' },
  createBtn: { flex: 2, backgroundColor: '#1a2e4a', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  createBtnText: { color: '#fff', fontWeight: '700' },
  disabledBtn: { opacity: 0.6 },
  errorText: { color: '#dc2626', fontSize: 13 },
});
