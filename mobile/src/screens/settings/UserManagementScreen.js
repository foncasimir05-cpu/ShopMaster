import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { getStaff, createStaff, updateStaff, deactivateStaff } from '../../services/api';

const ROLES = ['admin', 'manager', 'cashier'];
const ROLE_COLOR = { admin: '#1a2e4a', manager: '#0e9f6e', cashier: '#f59e0b' };

export default function UserManagementScreen() {
  const { t } = useTranslation();
  const { user: me } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('cashier');
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);

  const load = () => {
    setLoading(true);
    getStaff()
      .then(setStaff)
      .catch(() => setError(t('users.errors.loadFailed')))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleAdd = async () => {
    if (!newName.trim() || !newEmail.trim() || !newPassword) {
      setAddError(t('users.errors.requiredFields'));
      return;
    }
    setAdding(true);
    setAddError('');
    try {
      await createStaff({ name: newName.trim(), email: newEmail.trim(), password: newPassword, role: newRole });
      setNewName(''); setNewEmail(''); setNewPassword(''); setNewRole('cashier');
      setShowAdd(false);
      load();
    } catch (err) {
      setAddError(err.response?.data?.error ?? t('users.errors.createFailed'));
    } finally {
      setAdding(false);
    }
  };

  const handleRoleChange = async (member, role) => {
    try {
      await updateStaff(member.id, { name: member.name, role });
      load();
    } catch {
      setError(t('users.errors.updateRoleFailed'));
    }
  };

  const handleDeactivate = async (id) => {
    try {
      await deactivateStaff(id);
      setExpandedId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error ?? t('users.errors.deactivateFailed'));
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a2e4a" />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>{t('users.manageStaff')}</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {staff.map(member => (
        <View key={member.id} style={[styles.card, !member.is_active && styles.cardInactive]}>
          <TouchableOpacity
            style={styles.cardRow}
            onPress={() => setExpandedId(expandedId === member.id ? null : member.id)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{member.name}</Text>
              <Text style={styles.memberEmail}>{member.email}</Text>
            </View>
            <View style={[styles.roleBadge, { backgroundColor: ROLE_COLOR[member.role] ?? '#6b7280' }]}>
              <Text style={styles.roleBadgeText}>{t(`users.roles.${member.role}`, { defaultValue: member.role })}</Text>
            </View>
            {!member.is_active && <Text style={styles.inactiveTag}>{t('users.inactive')}</Text>}
          </TouchableOpacity>

          {expandedId === member.id && member.is_active && (
            <View style={styles.expandedPanel}>
              <Text style={styles.expandedLabel}>{t('users.changeRole')}</Text>
              <View style={styles.roleRow}>
                {ROLES.map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleChip, member.role === r && styles.roleChipActive]}
                    onPress={() => handleRoleChange(member, r)}
                  >
                    <Text style={[styles.roleChipText, member.role === r && styles.roleChipTextActive]}>
                      {t(`users.roles.${r}`, { defaultValue: r })}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {member.id !== me?.id && (
                <TouchableOpacity style={styles.deactivateBtn} onPress={() => handleDeactivate(member.id)}>
                  <Text style={styles.deactivateBtnText}>{t('users.deactivate')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      ))}

      {!showAdd ? (
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={styles.addBtnText}>+ {t('users.addStaff')}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.addForm}>
          <Text style={styles.addFormTitle}>{t('users.newStaffMember')}</Text>
          <Field label={t('users.fields.name')} value={newName} onChangeText={setNewName} placeholder="Jane Smith" />
          <Field label={t('users.fields.email')} value={newEmail} onChangeText={setNewEmail} keyboardType="email-address" autoCapitalize="none" placeholder="jane@example.com" />
          <Field label={t('users.fields.password')} value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="Min. 8 characters" />

          <Text style={styles.label}>{t('users.fields.role')}</Text>
          <View style={styles.roleRow}>
            {ROLES.map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.roleChip, newRole === r && styles.roleChipActive]}
                onPress={() => setNewRole(r)}
              >
                <Text style={[styles.roleChipText, newRole === r && styles.roleChipTextActive]}>
                  {t(`users.roles.${r}`, { defaultValue: r })}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {addError ? <Text style={styles.errorText}>{addError}</Text> : null}

          <View style={styles.formActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowAdd(false); setAddError(''); }}>
              <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, adding && styles.saveBtnDisabled]} onPress={handleAdd} disabled={adding}>
              <Text style={styles.saveBtnText}>{adding ? t('users.adding') : t('users.addStaff')}</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  content: { padding: 24, paddingTop: 60, paddingBottom: 40 },
  heading: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, overflow: 'hidden' },
  cardInactive: { opacity: 0.5 },
  cardRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  memberName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  memberEmail: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  roleBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  roleBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  inactiveTag: { fontSize: 11, color: '#9ca3af', fontStyle: 'italic' },
  expandedPanel: { borderTopWidth: 1, borderTopColor: '#f3f4f6', padding: 14, gap: 10 },
  expandedLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' },
  roleRow: { flexDirection: 'row', gap: 8 },
  roleChip: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  roleChipActive: { backgroundColor: '#1a2e4a', borderColor: '#1a2e4a' },
  roleChipText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  roleChipTextActive: { color: '#fff' },
  deactivateBtn: { alignSelf: 'flex-start', marginTop: 4 },
  deactivateBtnText: { color: '#dc2626', fontSize: 13, fontWeight: '600' },
  addBtn: { backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', borderStyle: 'dashed', marginTop: 4 },
  addBtnText: { color: '#1a2e4a', fontWeight: '700', fontSize: 15 },
  addForm: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 4, gap: 10 },
  addFormTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  fieldWrap: { gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  errorText: { color: '#dc2626', fontSize: 13 },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { color: '#374151', fontWeight: '600' },
  saveBtn: { flex: 1, backgroundColor: '#1a2e4a', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '700' },
});
