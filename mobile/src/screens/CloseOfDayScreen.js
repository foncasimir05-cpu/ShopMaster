import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDayCloseSummary, saveDayClosure, getDayCloseHistory } from '../services/api';
import { formatCurrency } from 'shopmaster-shared';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(str) {
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

export default function CloseOfDayScreen({ navigation }) {
  const [date] = useState(todayStr());
  const [summary, setSummary] = useState(null);
  const [byMethod, setByMethod] = useState([]);
  const [existingClosure, setExistingClosure] = useState(null);
  const [actualCash, setActualCash] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDayCloseSummary(date);
      setSummary(data.summary);
      setByMethod(data.byMethod);
      setExistingClosure(data.existingClosure);
      if (data.existingClosure) {
        setActualCash(String(data.existingClosure.actual_cash));
        setNotes(data.existingClosure.notes ?? '');
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error ?? 'Could not load day summary.');
    } finally {
      setLoading(false);
    }
  }, [date]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await getDayCloseHistory();
      setHistory(data);
    } catch {} finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
    loadHistory();
  }, [loadSummary, loadHistory]);

  const cashExpected = summary?.cash_revenue ?? 0;
  const actualCashNum = parseFloat(actualCash) || 0;
  const difference = actualCashNum - cashExpected;
  const diffIsGood = difference >= 0;

  const handleSave = async () => {
    if (!actualCash.trim()) {
      Alert.alert('Required', 'Please enter the actual cash in drawer.');
      return;
    }
    if (existingClosure) {
      Alert.alert(
        'Already Closed',
        `This day was already closed at ${new Date(existingClosure.created_at).toLocaleTimeString()}. Save a new record anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save Again', onPress: doSave },
        ]
      );
    } else {
      doSave();
    }
  };

  const doSave = async () => {
    setSaving(true);
    try {
      await saveDayClosure({
        date,
        total_sales: summary?.total_sales ?? 0,
        total_revenue: summary?.total_revenue ?? 0,
        cash_expected: cashExpected,
        actual_cash: actualCashNum,
        notes: notes.trim() || null,
      });
      Alert.alert('Saved', 'Day closure recorded successfully.');
      await loadSummary();
      await loadHistory();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error ?? 'Could not save closure.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1a2e4a" />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Close of Day</Text>
          <Text style={styles.dateText}>{fmtDate(date)}</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1a2e4a" style={{ marginTop: 40 }} />
      ) : (
        <>
          {/* Sales Summary */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Today's Sales Summary</Text>
            <Row label="Total Transactions" value={String(summary?.total_sales ?? 0)} />
            <Row label="Total Revenue" value={formatCurrency(summary?.total_revenue ?? 0)} bold />
            <View style={styles.divider} />
            {byMethod.map(m => (
              <Row
                key={m.payment_method}
                label={`${capitalize(m.payment_method)} (${m.count} sales)`}
                value={formatCurrency(m.revenue)}
              />
            ))}
            {byMethod.length === 0 && (
              <Text style={styles.emptyText}>No sales recorded today.</Text>
            )}
          </View>

          {/* Cash Reconciliation */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Cash Reconciliation</Text>
            <Row label="Expected Cash" value={formatCurrency(cashExpected)} />

            <Text style={styles.inputLabel}>Actual Cash in Drawer</Text>
            <TextInput
              style={styles.input}
              value={actualCash}
              onChangeText={setActualCash}
              placeholder="0"
              keyboardType="numeric"
            />

            {actualCash !== '' && (
              <View style={[styles.diffBox, diffIsGood ? styles.diffGood : styles.diffBad]}>
                <Ionicons
                  name={diffIsGood ? 'checkmark-circle' : 'warning'}
                  size={18}
                  color={diffIsGood ? '#065f46' : '#991b1b'}
                />
                <Text style={[styles.diffText, { color: diffIsGood ? '#065f46' : '#991b1b' }]}>
                  {diffIsGood
                    ? difference === 0
                      ? 'Cash matches exactly'
                      : `Over by ${formatCurrency(difference)}`
                    : `Short by ${formatCurrency(Math.abs(difference))}`}
                </Text>
              </View>
            )}

            <Text style={styles.inputLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. missing receipt #4, counted twice..."
              multiline
            />

            {existingClosure && (
              <View style={styles.alreadyClosedBanner}>
                <Ionicons name="information-circle-outline" size={15} color="#1d4ed8" />
                <Text style={styles.alreadyClosedText}>
                  Previously closed at {new Date(existingClosure.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            )}

            {saving ? (
              <ActivityIndicator size="large" color="#1a2e4a" style={{ marginTop: 16 }} />
            ) : (
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Ionicons name="lock-closed-outline" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>
                  {existingClosure ? 'Save New Record' : 'Close Day & Save'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* History */}
          <Text style={styles.historyTitle}>Past Closures</Text>
          {historyLoading ? (
            <ActivityIndicator size="small" color="#9ca3af" />
          ) : history.length === 0 ? (
            <Text style={styles.emptyText}>No past closures yet.</Text>
          ) : (
            history.map(h => (
              <View key={h.id} style={styles.historyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyDate}>{fmtDate(h.date)}</Text>
                  <Text style={styles.historyMeta}>
                    {h.total_sales} sales · {formatCurrency(h.total_revenue)} · by {h.closed_by_name}
                  </Text>
                  {h.notes ? <Text style={styles.historyNotes}>{h.notes}</Text> : null}
                </View>
                <View style={[styles.historyDiff, h.difference >= 0 ? styles.diffGoodBg : styles.diffBadBg]}>
                  <Text style={[styles.historyDiffText, { color: h.difference >= 0 ? '#065f46' : '#991b1b' }]}>
                    {h.difference >= 0 ? '+' : ''}{formatCurrency(h.difference)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

function Row({ label, value, bold }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.rowValueBold]}>{value}</Text>
    </View>
  );
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 20, paddingTop: 52, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  backBtn: { padding: 4 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  dateText: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1a2e4a', marginBottom: 12 },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  rowLabel: { fontSize: 13, color: '#6b7280' },
  rowValue: { fontSize: 13, color: '#111827', fontWeight: '500' },
  rowValueBold: { fontSize: 15, fontWeight: '700', color: '#1a2e4a' },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  notesInput: { minHeight: 72, textAlignVertical: 'top' },
  diffBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, padding: 10, marginTop: 10 },
  diffGood: { backgroundColor: '#d1fae5' },
  diffBad: { backgroundColor: '#fee2e2' },
  diffText: { fontSize: 14, fontWeight: '600' },
  alreadyClosedBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#eff6ff', borderRadius: 8, padding: 10, marginTop: 10 },
  alreadyClosedText: { color: '#1d4ed8', fontSize: 12 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1a2e4a', borderRadius: 10, paddingVertical: 14, marginTop: 16 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  historyTitle: { fontSize: 14, fontWeight: '700', color: '#6b7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  historyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, elevation: 1, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4 },
  historyDate: { fontSize: 13, fontWeight: '700', color: '#111827' },
  historyMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  historyNotes: { fontSize: 11, color: '#9ca3af', marginTop: 2, fontStyle: 'italic' },
  historyDiff: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: 70, alignItems: 'center' },
  diffGoodBg: { backgroundColor: '#d1fae5' },
  diffBadBg: { backgroundColor: '#fee2e2' },
  historyDiffText: { fontSize: 13, fontWeight: '700' },
  emptyText: { color: '#9ca3af', fontSize: 13, textAlign: 'center', marginVertical: 12 },
});
