import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';

/**
 * Camera-based barcode scanner for Android/mobile.
 * On web, renders a text input fallback (USB HID scanners emit keyboard input).
 */
export default function BarcodeScanner({ onScan, onClose }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      const { BarCodeScanner } = await import('expo-barcode-scanner');
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = ({ data }) => {
    if (scanned) return;
    setScanned(true);
    onScan(data);
  };

  // Web fallback: USB HID barcode scanners behave as keyboards
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Scan or Type Barcode</Text>
        <Text style={styles.hint}>USB barcode scanners will auto-submit. Or type manually:</Text>
        <WebBarcodeInput onScan={onScan} onClose={onClose} />
      </View>
    );
  }

  if (hasPermission === null) {
    return <View style={styles.container}><Text>Requesting camera permission…</Text></View>;
  }
  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.noAccess}>Camera access denied.</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <NativeScanner onScanned={handleBarCodeScanned} />
      <TouchableOpacity style={styles.closeOverlay} onPress={onClose}>
        <Text style={styles.closeBtnText}>✕ Cancel</Text>
      </TouchableOpacity>
      {scanned && (
        <TouchableOpacity style={styles.rescanBtn} onPress={() => setScanned(false)}>
          <Text style={styles.closeBtnText}>Tap to scan again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function NativeScanner({ onScanned }) {
  const [BarCodeScanner, setBarCodeScanner] = React.useState(null);

  React.useEffect(() => {
    import('expo-barcode-scanner').then(mod => setBarCodeScanner(() => mod.BarCodeScanner));
  }, []);

  if (!BarCodeScanner) return null;
  return <BarCodeScanner style={{ flex: 1 }} onBarCodeScanned={onScanned} />;
}

function WebBarcodeInput({ onScan, onClose }) {
  const [value, setValue] = React.useState('');
  return (
    <View style={{ padding: 24 }}>
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
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  hint: { color: '#d1d5db', fontSize: 13, marginBottom: 16 },
  noAccess: { color: '#ef4444', fontSize: 16, marginBottom: 16 },
  closeOverlay: {
    position: 'absolute', top: 40, right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  rescanBtn: {
    position: 'absolute', bottom: 40, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  closeBtn: { backgroundColor: '#1a56db', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  closeBtnText: { color: '#fff', fontWeight: '600' },
});
