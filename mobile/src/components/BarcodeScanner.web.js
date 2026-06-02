import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function BarcodeScanner({ onScan, onClose }) {
  const [value, setValue] = React.useState('');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Scan or Type Barcode</Text>
      <Text style={styles.hint}>USB barcode scanners will auto-submit. Or type manually:</Text>
      <input
        autoFocus
        style={{ fontSize: 18, padding: 10, width: '100%', border: '1px solid #d1d5db', borderRadius: 8 }}
        placeholder="Barcode…"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && value.trim()) {
            onScan(value.trim());
          }
        }}
      />
      <TouchableOpacity style={{ marginTop: 12, alignItems: 'center' }} onPress={onClose}>
        <Text style={{ color: '#ef4444' }}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111', padding: 24 },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  hint: { color: '#d1d5db', fontSize: 13, marginBottom: 16 },
});
