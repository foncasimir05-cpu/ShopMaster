import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Linking, Alert } from 'react-native';
import { formatCurrency } from 'shopmaster-shared';
import { getInvoiceUrl } from '../services/api';

/**
 * Shows a summary of a sale and provides a button to download / open the PDF invoice.
 * On mobile with expo-print available it opens in-app; on web it navigates to the URL.
 */
export default function InvoicePreview({ sale, items }) {
  const openInvoice = async () => {
    const url = getInvoiceUrl(sale.id);
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
      return;
    }
    try {
      const { printAsync } = await import('expo-print');
      // Download the PDF from the API and render it via expo-print
      const response = await fetch(url);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result.split(',')[1];
        await printAsync({ uri: `data:application/pdf;base64,${base64}` });
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      Alert.alert('Error', 'Could not open invoice: ' + err.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Invoice #{sale.id.slice(0, 8).toUpperCase()}</Text>
      <Text style={styles.date}>{new Date(sale.created_at).toLocaleString()}</Text>

      {items.map(item => (
        <View key={item.id} style={styles.itemRow}>
          <Text style={styles.itemName}>{item.product_name}</Text>
          <Text style={styles.itemDetail}>
            {item.quantity} × {formatCurrency(item.unit_price)} = {formatCurrency(item.subtotal)}
          </Text>
        </View>
      ))}

      <View style={styles.divider} />
      <View style={styles.summaryRow}>
        <Text>Discount</Text>
        <Text>-{formatCurrency(sale.discount)}</Text>
      </View>
      <View style={styles.summaryRow}>
        <Text>Tax</Text>
        <Text>{formatCurrency(sale.tax)}</Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatCurrency(sale.total)}</Text>
      </View>

      <TouchableOpacity style={styles.downloadBtn} onPress={openInvoice}>
        <Text style={styles.downloadText}>Download PDF Invoice</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', borderRadius: 12, padding: 20, margin: 16 },
  heading: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  date: { fontSize: 12, color: '#6b7280', marginBottom: 16 },
  itemRow: { marginBottom: 8 },
  itemName: { fontSize: 14, fontWeight: '600', color: '#374151' },
  itemDetail: { fontSize: 13, color: '#6b7280' },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  totalLabel: { fontSize: 16, fontWeight: 'bold' },
  totalValue: { fontSize: 16, fontWeight: 'bold', color: '#1a56db' },
  downloadBtn: {
    backgroundColor: '#1a56db', borderRadius: 8, paddingVertical: 12,
    alignItems: 'center', marginTop: 16,
  },
  downloadText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
