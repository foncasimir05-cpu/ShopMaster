import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function BarcodeScanner({ onScan, onClose }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torch, setTorch] = useState(false);

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text>Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Camera access needed</Text>
        <Text style={styles.subText}>Allow camera access to scan barcodes</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.btn}>
          <Text style={styles.btnText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={[styles.btn, { marginTop: 8, backgroundColor: '#6b7280' }]}>
          <Text style={styles.btnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleScan = ({ data }) => {
    if (scanned) return;
    setScanned(true);
    onScan(data);
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torch}
        onBarcodeScanned={scanned ? undefined : handleScan}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a'],
        }}
      />
      <View style={styles.overlay}>
        <View style={styles.reticle} />
        <TouchableOpacity onPress={() => setTorch(t => !t)} style={styles.torchBtn}>
          <Text style={styles.torchText}>{torch ? '🔦 ON' : '🔦 OFF'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕ Cancel</Text>
        </TouchableOpacity>
        {scanned && (
          <TouchableOpacity onPress={() => setScanned(false)} style={styles.rescanBtn}>
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
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  reticle: { width: 250, height: 250, borderWidth: 2, borderColor: '#f5a623', borderRadius: 12 },
  torchBtn: { position: 'absolute', bottom: 140, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  torchText: { color: '#fff', fontWeight: '600' },
  closeBtn: { position: 'absolute', top: 50, right: 20, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  closeBtnText: { color: '#fff', fontWeight: '600' },
  rescanBtn: { position: 'absolute', bottom: 80, backgroundColor: '#1a2e4a', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  btn: { backgroundColor: '#1a2e4a', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '600' },
});
