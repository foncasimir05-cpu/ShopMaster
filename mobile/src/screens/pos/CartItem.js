import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useShop } from '../../context/ShopContext';

export default function CartItem({ item, onRemove, onChangeQty }) {
  const { t } = useTranslation();
  const { formatCurrency } = useShop();
  const { cartKey, product, variant, quantity } = item;
  const price = variant ? variant.price : product.price;

  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
        {variant && <Text style={styles.variantTag}>{variant.name}</Text>}
        <Text style={styles.unitPrice}>{formatCurrency(price)} {t('pos.each')}</Text>
      </View>

      <View style={styles.qtyWrap}>
        <TouchableOpacity
          style={styles.qtyBtn}
          onPress={() => quantity > 1 ? onChangeQty(cartKey, quantity - 1) : onRemove(cartKey)}
          activeOpacity={0.7}
        >
          <Ionicons name={quantity === 1 ? 'trash-outline' : 'remove'} size={14} color={quantity === 1 ? '#ef4444' : '#374151'} />
        </TouchableOpacity>

        <Text style={styles.qty}>{quantity}</Text>

        <TouchableOpacity
          style={[styles.qtyBtn, styles.qtyBtnPlus]}
          onPress={() => onChangeQty(cartKey, quantity + 1)}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={14} color="#2563eb" />
        </TouchableOpacity>
      </View>

      <Text style={styles.subtotal}>{formatCurrency(price * quantity)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  variantTag: {
    fontSize: 11, fontWeight: '600', color: '#7c3aed',
    marginTop: 1, backgroundColor: '#f3e8ff',
    alignSelf: 'flex-start', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4,
  },
  unitPrice: { fontSize: 11, color: '#94a3b8', marginTop: 2 },

  qtyWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f8fafc', borderRadius: 20,
    borderWidth: 1, borderColor: '#e2e8f0',
    padding: 2, gap: 2,
  },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnPlus: { backgroundColor: '#eff6ff' },
  qty: {
    minWidth: 26, textAlign: 'center',
    fontSize: 13, fontWeight: '800', color: '#0f172a',
  },

  subtotal: {
    fontSize: 13, fontWeight: '800', color: '#2563eb',
    minWidth: 60, textAlign: 'right',
  },
});
