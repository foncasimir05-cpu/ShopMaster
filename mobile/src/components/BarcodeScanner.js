import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';

export default function BarcodeScanner({ onScan, onClose }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    const requestPermission = async () => {
      try {
        const { status } = await BarCodeScanner.requestPermissionsAsync();
        setHasPermission(status === 'granted');
      } catch (err) {
        console.error('Camera permission error:', err);
        setHasPermission(false);
      }
    };
    requestPermission();
  }, []);

  const handleScan = ({ type, data }) => {
    if (scanned) return;
    setScanned(true);
    onScan(data);
  };

  if (hasPermission === null) {
    return (
      <View style={styles.center}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Camera access denied.</Text>
        <Text style={styles.subText}>
          Go to phone Settings → Apps → ShopMaster → Permissions → Camera → Allow
        </Text>
        <TouchableOpacity onPress={onClose} style={styles.btn}>
          <Text style={styles.btnText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BarCodeScanner
        onBarCodeScanned={scanned ? undefined : handleScan}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.overlay}>
        <View style={styles.reticle} />
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕ Cancel</Text>
        </TouchableOpacity>
        {scanned && (
          <TouchableOpacity
            onPress={() => setScanned(false)}
            style={styles.rescanBtn}
          >
            <Text style={styles.btnText}>Tap to Scan Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { fontSize: 16, fontWeight: 'bold', color: '#dc2626', marginBottom: 8 },
  subText: { textAlign: 'center', color: '#6b7280', marginBottom: 24 },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
  },
  reticle: {
    width: 250, height: 250,
    borderWidth: 2, borderColor: '#f5a623',
    borderRadius: 12, backgroundColor: 'transparent',
  },
  closeBtn: {
    position: 'absolute', top: 50, right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8,
  },
  closeBtnText: { color: '#fff', fontWeight: '600' },
  rescanBtn: {
    position: 'absolute', bottom: 80,
    backgroundColor: '#1a2e4a',
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8,
  },
  btn: { backgroundColor: '#1a2e4a', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '600' },
});
