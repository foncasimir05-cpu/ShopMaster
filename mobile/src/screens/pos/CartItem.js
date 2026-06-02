import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { formatCurrency } from 'shopmaster-shared';

export default function CartItem({ item, onRemove, onChangeQty }) {
  const { product, quantity } = item;

  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
        <Text style={styles.price}>{formatCurrency(product.price)} each</Text>
      </View>

      <View style={styles.qtyRow}>
        <TouchableOpacity
          style={styles.qtyBtn}
          onPress={() => quantity > 1 ? onChangeQty(product.id, quantity - 1) : onRemove(product.id)}
        >
          <Text style={styles.qtyBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.qty}>{quantity}</Text>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => onChangeQty(product.id, quantity + 1)}>
          <Text style={styles.qtyBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.subtotal}>{formatCurrency(product.price * quantity)}</Text>

      <TouchableOpacity style={styles.removeBtn} onPress={() => onRemove(product.id)}>
        <Text style={styles.removeBtnText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  info: { flex: 1 },
  name: { fontSize: 13, fontWeight: '600', color: '#111827' },
  price: { fontSize: 11, color: '#6b7280', marginTop: 1 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 8 },
  qtyBtn: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnText: { fontSize: 16, fontWeight: '700', color: '#374151', lineHeight: 20 },
  qty: { width: 28, textAlign: 'center', fontSize: 14, fontWeight: '700', color: '#111827' },
  subtotal: { fontSize: 13, fontWeight: '700', color: '#1a56db', minWidth: 56, textAlign: 'right' },
  removeBtn: { padding: 6, marginLeft: 4 },
  removeBtnText: { fontSize: 13, color: '#ef4444', fontWeight: '700' },
});
