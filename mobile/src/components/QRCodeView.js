import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { buildQRMatrix } from '../utils/qrHelpers';

/**
 * Renders a QR code as a grid of View squares — no native SVG library needed.
 * @param {string} value  - text to encode
 * @param {number} size   - total pixel size (width = height)
 */
export default function QRCodeView({ value, size = 180 }) {
  const matrix = useMemo(() => {
    try { return buildQRMatrix(value); }
    catch { return null; }
  }, [value]);

  if (!matrix) return null;

  const cell = size / matrix.size;

  return (
    <View style={{ width: size, height: size, backgroundColor: '#fff' }}>
      {Array.from({ length: matrix.size }, (_, row) => (
        <View key={row} style={{ flexDirection: 'row', height: cell }}>
          {Array.from({ length: matrix.size }, (_, col) => (
            <View
              key={col}
              style={{
                width: cell,
                height: cell,
                backgroundColor: matrix.data[row * matrix.size + col] ? '#000' : '#fff',
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
