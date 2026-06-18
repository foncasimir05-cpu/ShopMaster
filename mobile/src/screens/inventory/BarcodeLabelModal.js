import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import QRCodeView from '../../components/QRCodeView';
import { generateBarcode, buildLabelHTML } from '../../utils/qrHelpers';
import { updateProduct } from '../../services/api';

export default function BarcodeLabelModal({ visible, product, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [currentCode, setCurrentCode] = useState('');

  useEffect(() => {
    if (!product) return;
    // Use existing barcode or SKU if present, otherwise generate a new one
    setCurrentCode(product.barcode || product.sku || generateBarcode(product.id));
  }, [product]);

  if (!product) return null;

  const isGenerated = !product.barcode && !product.sku;
  const alreadySaved = !!product.barcode || !!product.sku;

  const handleSaveCode = async () => {
    setSaving(true);
    try {
      await updateProduct(product.id, { barcode: currentCode });
      Alert.alert('Saved', `Barcode "${currentCode}" has been saved to this product. It will now be found when scanned at the POS.`);
      onSaved && onSaved(product.id, currentCode);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error ?? err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const html = buildLabelHTML(product.name, currentCode);
      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Print or share label' });
      } else {
        await Print.printAsync({ uri });
      }
    } catch (err) {
      Alert.alert('Print Error', err.message);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <Text style={styles.title}>Product Label</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {/* QR Preview */}
            <View style={styles.qrWrap}>
              <QRCodeView value={currentCode} size={190} />
            </View>

            {/* Code value */}
            <Text style={styles.codeText}>{currentCode}</Text>
            <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>

            {/* Info badge */}
            {isGenerated && (
              <View style={styles.infoBadge}>
                <Text style={styles.infoText}>
                  This code was auto-generated. Save it to the product so it's recognized at the POS when scanned.
                </Text>
              </View>
            )}
            {alreadySaved && (
              <View style={[styles.infoBadge, styles.successBadge]}>
                <Text style={[styles.infoText, { color: '#065f46' }]}>
                  This product already has a code. Scanning it at the POS will add it to the cart.
                </Text>
              </View>
            )}

            {/* Actions */}
            <View style={styles.actions}>
              {isGenerated && (
                <TouchableOpacity
                  style={[styles.btn, styles.saveBtn, saving && styles.btnDisabled]}
                  onPress={handleSaveCode}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.btnText}>Save Code to Product</Text>}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.btn, styles.printBtn, printing && styles.btnDisabled]}
                onPress={handlePrint}
                disabled={printing}
              >
                {printing
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.btnText}>🖨  Print Label</Text>}
              </TouchableOpacity>
            </View>

            {/* Scan hint */}
            <Text style={styles.hint}>
              Print this label, stick it on the product, then scan it with the camera or USB scanner at POS.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12,
    maxHeight: '90%',
  },
  handle: {
    width: 40, height: 4, backgroundColor: '#e2e8f0',
    borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  closeX: { fontSize: 18, color: '#94a3b8', fontWeight: '700' },

  body: { alignItems: 'center', paddingBottom: 8 },

  qrWrap: {
    padding: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#e2e8f0',
    marginBottom: 16, backgroundColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },

  codeText: {
    fontFamily: 'monospace',
    fontSize: 17, fontWeight: '700', letterSpacing: 2,
    color: '#1a2e4a', marginBottom: 6,
  },
  productName: {
    fontSize: 13, color: '#6b7280', textAlign: 'center',
    marginBottom: 14, paddingHorizontal: 16,
  },

  infoBadge: {
    backgroundColor: '#eff6ff', borderRadius: 10, padding: 12,
    marginBottom: 20, width: '100%',
  },
  successBadge: { backgroundColor: '#f0fdf4' },
  infoText: { fontSize: 12, color: '#1e40af', lineHeight: 18, textAlign: 'center' },

  actions: { width: '100%', gap: 10, marginBottom: 16 },
  btn: {
    borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  saveBtn: { backgroundColor: '#1a2e4a' },
  printBtn: { backgroundColor: '#059669' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  hint: {
    fontSize: 11, color: '#94a3b8', textAlign: 'center',
    lineHeight: 16, paddingHorizontal: 8,
  },
});
