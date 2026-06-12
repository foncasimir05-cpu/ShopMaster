import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useShop } from '../../context/ShopContext';

export default function PaymentModal({ visible, total, paymentMethod, onConfirm, onCancel, loading }) {
  const { t } = useTranslation();
  const { formatCurrency } = useShop();
  const [tendered, setTendered] = useState('');
  const tenderedNum = parseFloat(tendered) || 0;
  const change = paymentMethod === 'cash' ? Math.max(0, tenderedNum - total) : 0;
  const canCharge = paymentMethod !== 'cash' || tenderedNum >= total;

  const handleConfirm = () => {
    onConfirm({ tendered: paymentMethod === 'cash' ? tenderedNum : total, change });
  };

  const canChargeRef = useRef(canCharge);
  const loadingRef = useRef(loading);
  const handleConfirmRef = useRef(handleConfirm);
  canChargeRef.current = canCharge;
  loadingRef.current = loading;
  handleConfirmRef.current = handleConfirm;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKeyDown = e => {
      if (e.key === 'Enter' && !e.repeat && canChargeRef.current && !loadingRef.current) {
        e.preventDefault();
        handleConfirmRef.current();
      }
    };
    if (visible) window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.title}>{t('pos.payment.title')}</Text>
          <Text style={styles.method}>
            {paymentMethod === 'cash' ? `💵 ${t('pos.cash')}` : paymentMethod === 'card' ? `💳 ${t('pos.card')}` : `📱 ${t('pos.mobileMoney')}`}
          </Text>

          <Text style={styles.totalLabel}>{t('pos.payment.amountDue')}</Text>
          <Text style={styles.totalValue}>{formatCurrency(total)}</Text>

          {paymentMethod === 'cash' && (
            <>
              <Text style={styles.inputLabel}>{t('pos.payment.cashTendered')}</Text>
              <TextInput
                style={styles.input}
                value={tendered}
                onChangeText={setTendered}
                keyboardType="numeric"
                placeholder="0.00"
                autoFocus
              />
              {tenderedNum > 0 && (
                <View style={styles.changeRow}>
                  <Text style={styles.changeLabel}>{t('pos.payment.change')}</Text>
                  <Text style={[styles.changeValue, change < 0 && styles.changeNeg]}>
                    {formatCurrency(change)}
                  </Text>
                </View>
              )}
            </>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={loading}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, !canCharge && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!canCharge || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmText}>
                  {paymentMethod === 'cash' ? t('pos.payment.collectCash') : t('pos.payment.confirm')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', padding: 24,
  },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  title: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 4 },
  method: { fontSize: 14, color: '#6b7280', marginBottom: 20 },
  totalLabel: { fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  totalValue: { fontSize: 32, fontWeight: '900', color: '#111827', marginBottom: 20 },
  inputLabel: { fontSize: 13, color: '#374151', fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 2, borderColor: '#1a56db', borderRadius: 8,
    fontSize: 22, paddingHorizontal: 14, paddingVertical: 10,
    textAlign: 'right', marginBottom: 12,
  },
  changeRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: '#f0fdf4', borderRadius: 8, padding: 12, marginBottom: 8,
  },
  changeLabel: { fontSize: 15, color: '#166534', fontWeight: '600' },
  changeValue: { fontSize: 15, fontWeight: '800', color: '#166534' },
  changeNeg: { color: '#dc2626' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: '#d1d5db',
    borderRadius: 10, paddingVertical: 14, alignItems: 'center',
  },
  cancelText: { fontSize: 15, color: '#374151', fontWeight: '600' },
  confirmBtn: {
    flex: 2, backgroundColor: '#1a56db',
    borderRadius: 10, paddingVertical: 14, alignItems: 'center',
  },
  confirmBtnDisabled: { backgroundColor: '#93c5fd' },
  confirmText: { fontSize: 15, color: '#fff', fontWeight: '700' },
});
