import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Platform,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as api from '../services/api';
import { useShop } from '../context/ShopContext';
import BarcodeScanner from '../components/BarcodeScanner';
import { useStockAlert } from '../context/StockAlertContext';

const CAT_MAP = {
  food:'#f59e0b', drink:'#06b6d4', bev:'#06b6d4', electr:'#6366f1',
  cloth:'#ec4899', fashion:'#ec4899', health:'#10b981', beauty:'#f43f5e',
  home:'#8b5cf6', office:'#0891b2', sport:'#16a34a', baby:'#f472b6',
};
const CAT_PALETTE = ['#2563eb','#7c3aed','#db2777','#059669','#d97706','#0891b2','#ea580c'];
function catColor(category) {
  if (!category) return '#94a3b8';
  const k = category.toLowerCase();
  for (const [key, val] of Object.entries(CAT_MAP)) if (k.includes(key)) return val;
  let h = 0;
  for (let i = 0; i < category.length; i++) h = category.charCodeAt(i) + ((h << 5) - h);
  return CAT_PALETTE[Math.abs(h) % CAT_PALETTE.length];
}

const CAN_SCAN = Platform.OS !== 'web';

export default function ProductsScreen() {
  const { t } = useTranslation();
  const { formatCurrency } = useShop();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm] = useState({ name: '', sku: '', barcode: '', price: '', cost: '', stock: '', category: '', min_stock: '' });
  const [scannerVisible, setScannerVisible] = useState(false);
  const [importVisible, setImportVisible] = useState(false);
  const [importCsv, setImportCsv] = useState('');
  const [importing, setImporting] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const { refresh: refreshAlerts } = useStockAlert();

  const categories = useMemo(() => {
    const seen = new Map();
    for (const p of products) {
      if (p.category) {
        const key = p.category.trim().toLowerCase();
        if (!seen.has(key)) seen.set(key, p.category.trim());
      }
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }, [products]);

  const displayedProducts = useMemo(() => {
    if (!activeCategory) return products;
    const norm = activeCategory.trim().toLowerCase();
    return products.filter(p => p.category?.trim().toLowerCase() === norm);
  }, [products, activeCategory]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getProducts({ search });
      setProducts(data);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const openCreate = () => {
    setEditProduct(null);
    setForm({ name: '', sku: '', barcode: '', price: '', cost: '', stock: '', category: '', min_stock: '' });
    setModalVisible(true);
  };

  const openEdit = product => {
    setEditProduct(product);
    setForm({
      name: product.name,
      sku: product.sku ?? '',
      barcode: product.barcode ?? '',
      price: String(product.price),
      cost: product.cost ? String(product.cost) : '',
      stock: String(product.stock),
      category: product.category ?? '',
      min_stock: product.min_stock ? String(product.min_stock) : '',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name) { Alert.alert(t('common.error'), t('products.errors.nameRequired')); return; }
    try {
      const payload = {
        name: form.name,
        sku: form.sku || undefined,
        barcode: form.barcode || undefined,
        price: parseFloat(form.price) || 0,
        cost: parseFloat(form.cost) || 0,
        stock: parseInt(form.stock, 10) || 0,
        category: form.category.trim() || undefined,
        min_stock: parseInt(form.min_stock, 10) || 0,
      };
      if (editProduct) {
        await api.updateProduct(editProduct.id, payload);
      } else {
        await api.createProduct(payload);
      }
      setModalVisible(false);
      fetchProducts();
      refreshAlerts();
    } catch (err) {
      Alert.alert(t('products.saveFailed'), err.response?.data?.error ?? err.message);
    }
  };

  const handleDelete = product => {
    const doDelete = async () => {
      try {
        await api.deleteProduct(product.id);
        fetchProducts();
        refreshAlerts();
      } catch (err) {
        Alert.alert('Delete failed', err.response?.data?.error ?? err.message);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(t('products.deleteConfirm', { name: product.name }))) {
        doDelete();
      }
    } else {
      Alert.alert(t('common.delete'), t('products.deleteConfirm', { name: product.name }), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  // ── Variant management ──────────────────────────────────────────────────────
  const [variantProduct, setVariantProduct] = useState(null);
  const [variants, setVariants] = useState([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [variantForm, setVariantForm] = useState({ name: '', sku: '', barcode: '', price: '', cost: '', stock: '' });
  const [editVariant, setEditVariant] = useState(null);
  const [variantFormVisible, setVariantFormVisible] = useState(false);
  // Tracks which attribute tabs are active in the variant builder
  const [attrTab, setAttrTab] = useState('size'); // 'size' | 'color' | 'weight' | 'custom'

  const openVariantManager = async (product) => {
    setVariantProduct(product);
    setLoadingVariants(true);
    try {
      const data = await api.getVariants(product.id);
      setVariants(data);
    } catch (err) { Alert.alert('Error', err.message); }
    finally { setLoadingVariants(false); }
  };

  const openAddVariant = () => {
    setEditVariant(null);
    setAttrTab('size');
    setVariantForm({ name: '', sku: '', barcode: '', price: variantProduct?.price?.toString() ?? '', cost: '', stock: '' });
    setVariantFormVisible(true);
  };

  const openEditVariant = (v) => {
    setEditVariant(v);
    setVariantForm({ name: v.name, sku: v.sku ?? '', barcode: v.barcode ?? '', price: String(v.price), cost: String(v.cost), stock: String(v.stock) });
    setVariantFormVisible(true);
  };

  const handleSaveVariant = async () => {
    if (!variantForm.name.trim()) { Alert.alert('Error', 'Variant name is required'); return; }
    try {
      const payload = {
        name: variantForm.name,
        sku: variantForm.sku || undefined,
        barcode: variantForm.barcode || undefined,
        price: parseFloat(variantForm.price) || 0,
        cost: parseFloat(variantForm.cost) || 0,
        stock: parseInt(variantForm.stock, 10) || 0,
      };
      if (editVariant) {
        await api.updateVariant(variantProduct.id, editVariant.id, payload);
      } else {
        await api.createVariant(variantProduct.id, payload);
      }
      setVariantFormVisible(false);
      const data = await api.getVariants(variantProduct.id);
      setVariants(data);
      fetchProducts();
    } catch (err) { Alert.alert('Error', err.response?.data?.error ?? err.message); }
  };

  const handleDeleteVariant = (v) => {
    const doDeleteVariant = async () => {
      try {
        await api.deleteVariant(variantProduct.id, v.id);
        const data = await api.getVariants(variantProduct.id);
        setVariants(data);
        fetchProducts();
      } catch (err) {
        Alert.alert('Delete failed', err.response?.data?.error ?? err.message);
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(t('products.deleteVariantConfirm', { name: v.name }))) doDeleteVariant();
    } else {
      Alert.alert(t('common.delete'), t('products.deleteVariantConfirm', { name: v.name }), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: doDeleteVariant },
      ]);
    }
  };

  const handleExport = async () => {
    try {
      const csv = await api.exportProductsCSV();
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'products.csv'; a.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({ message: csv, title: 'products.csv' });
      }
    } catch (err) { Alert.alert('Export failed', err.message); }
  };

  const handleImport = async () => {
    if (!importCsv.trim()) { Alert.alert('Error', 'Paste CSV content first'); return; }
    setImporting(true);
    try {
      const result = await api.importProductsCSV(importCsv);
      setImportVisible(false);
      setImportCsv('');
      fetchProducts();
      refreshAlerts();
      const errMsg = result.errors.length > 0 ? `\n\nErrors:\n${result.errors.slice(0, 3).join('\n')}` : '';
      Alert.alert('Import Complete', `Created: ${result.created}  Updated: ${result.updated}${errMsg}`);
    } catch (err) {
      Alert.alert('Import failed', err.response?.data?.error ?? err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleBarcodeScan = (data) => {
    setForm(f => ({ ...f, barcode: data }));
    setScannerVisible(false);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t('products.title')}</Text>
        <Text style={styles.countBadge}>{products.length}</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color="#94a3b8" />
        <TextInput
          style={styles.search}
          placeholder={t('products.searchPlaceholder')}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          onSubmitEditing={fetchProducts}
          placeholderTextColor="#94a3b8"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Category filter chips */}
      {categories.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catScrollContent}>
          <TouchableOpacity
            style={[styles.catChip, styles.catChipSpaced, !activeCategory && styles.catChipActive]}
            onPress={() => setActiveCategory(null)}
          >
            <Text style={[styles.catChipText, !activeCategory && styles.catChipTextActive]}>All</Text>
          </TouchableOpacity>
          {categories.map(cat => {
            const color = catColor(cat);
            const isActive = activeCategory?.trim().toLowerCase() === cat.toLowerCase();
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.catChip, styles.catChipSpaced, isActive && { backgroundColor: color + '20', borderColor: color }]}
                onPress={() => setActiveCategory(isActive ? null : cat)}
              >
                <View style={[styles.catDot, { backgroundColor: color }]} />
                <Text style={[styles.catChipText, isActive && { color }]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.toolbarRow}>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={styles.addBtnText}>{t('products.addProduct')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.csvBtn} onPress={() => setImportVisible(true)}>
          <Ionicons name="cloud-upload-outline" size={16} color="#1a2e4a" />
          <Text style={styles.csvBtnText}>{t('products.import')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.csvBtn} onPress={handleExport}>
          <Ionicons name="cloud-download-outline" size={16} color="#1a2e4a" />
          <Text style={styles.csvBtnText}>{t('products.export')}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={displayedProducts}
          keyExtractor={p => p.id}
          contentContainerStyle={{ paddingBottom: 16 }}
          renderItem={({ item }) => {
            const margin = item.price > 0 && item.cost > 0
              ? Math.round(((item.price - item.cost) / item.price) * 100)
              : null;
            const accent = catColor(item.category);
            const isLow = !item.has_variants && item.min_stock > 0 && item.stock <= item.min_stock;
            const isOOS = !item.has_variants && item.stock === 0;
            return (
              <View style={styles.row}>
                <View style={[styles.rowAccent, { backgroundColor: accent }]} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                  <View style={styles.rowMetaRow}>
                    {item.category ? (
                      <Text style={[styles.rowCat, { color: accent }]}>{item.category}</Text>
                    ) : null}
                    <Text style={styles.rowSub}>
                      {item.sku ? `SKU: ${item.sku}` : 'No SKU'}
                    </Text>
                    <Text style={[styles.rowStock, isOOS && styles.rowStockOOS, isLow && styles.rowStockLow]}>
                      {item.has_variants ? t('products.seeVariants') : t('products.inStock', { count: item.stock })}
                      {isLow && !isOOS ? ' ⚠' : ''}
                      {isOOS ? ` ${t('products.outOfStock')}` : ''}
                    </Text>
                  </View>
                </View>
                <View style={styles.rowRight}>
                  {margin !== null && (
                    <View style={styles.marginBadge}>
                      <Text style={styles.marginBadgeText}>{margin}%</Text>
                    </View>
                  )}
                  <Text style={styles.rowPrice}>{formatCurrency(item.price)}</Text>
                  <View style={styles.rowActions}>
                    <TouchableOpacity onPress={() => openVariantManager(item)} style={styles.iconBtn}>
                      <Ionicons name="options-outline" size={17} color={item.has_variants ? '#7c3aed' : '#cbd5e1'} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => openEdit(item)} style={styles.iconBtn}>
                      <Ionicons name="pencil-outline" size={17} color="#64748b" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item)} style={styles.iconBtn}>
                      <Ionicons name="trash-outline" size={17} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="cube-outline" size={40} color="#e2e8f0" />
              <Text style={styles.empty}>{t('products.noProductsFound')}</Text>
              {activeCategory && (
                <TouchableOpacity onPress={() => setActiveCategory(null)}>
                  <Text style={styles.emptyClear}>{t('products.clearFilter')}</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* Product form modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{editProduct ? t('products.editProduct') : t('products.newProduct')}</Text>

            {['name', 'sku', 'price', 'cost', 'stock', 'min_stock'].map(field => (
              <TextInput
                key={field}
                style={styles.input}
                placeholder={
                  field === 'min_stock' ? t('products.fields.minStock')
                  : field === 'cost' ? t('products.fields.cost')
                  : field === 'name' ? t('products.fields.name')
                  : field === 'sku' ? t('products.fields.sku')
                  : field === 'price' ? t('products.fields.price')
                  : field === 'stock' ? t('products.fields.stock')
                  : field.charAt(0).toUpperCase() + field.slice(1)
                }
                value={form[field]}
                onChangeText={v => setForm(f => ({ ...f, [field]: v }))}
                keyboardType={['price', 'cost', 'stock', 'min_stock'].includes(field) ? 'numeric' : 'default'}
              />
            ))}

            {/* Category: type or tap existing */}
            <TextInput
              style={styles.input}
              placeholder={t('products.fields.category')}
              value={form.category}
              onChangeText={v => setForm(f => ({ ...f, category: v }))}
              autoCapitalize="words"
              autoCorrect={false}
            />
            {categories.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.catSuggestScroll}
                contentContainerStyle={styles.catSuggestContent}
              >
                {categories.map(cat => {
                  const active = form.category.trim().toLowerCase() === cat.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.catSuggestChip, active && styles.catSuggestChipActive]}
                      onPress={() => setForm(f => ({ ...f, category: cat }))}
                    >
                      <Text style={[styles.catSuggestChipText, active && styles.catSuggestChipTextActive]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Barcode field with scan button (scan hidden on web/desktop) */}
            <View style={styles.barcodeRow}>
              <TextInput
                style={[styles.input, styles.barcodeInput]}
                placeholder={t('products.fields.barcode')}
                value={form.barcode}
                onChangeText={v => setForm(f => ({ ...f, barcode: v }))}
                returnKeyType="done"
                blurOnSubmit={false}
                onSubmitEditing={() => {}}
              />
              {CAN_SCAN && (
                <TouchableOpacity
                  style={styles.scanBtn}
                  onPress={() => setScannerVisible(true)}
                >
                  <Ionicons name="barcode-outline" size={22} color="#fff" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelBtn}>
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Barcode scanner modal — native only */}
      {CAN_SCAN && (
        <Modal visible={scannerVisible} animationType="slide">
          <BarcodeScanner
            onScan={handleBarcodeScan}
            onClose={() => setScannerVisible(false)}
          />
        </Modal>
      )}

      {/* Variant Manager Modal */}
      <Modal visible={!!variantProduct} animationType="slide" transparent onRequestClose={() => { setVariantProduct(null); setVariantFormVisible(false); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '85%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View>
                <Text style={styles.modalTitle}>Variants</Text>
                <Text style={{ fontSize: 12, color: '#6b7280' }}>{variantProduct?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => { setVariantProduct(null); setVariantFormVisible(false); }}>
                <Ionicons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {!variantFormVisible ? (
              <>
                <TouchableOpacity style={styles.addVariantBtn} onPress={openAddVariant}>
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={styles.addVariantBtnText}>Add Variant</Text>
                </TouchableOpacity>

                {loadingVariants ? (
                  <ActivityIndicator style={{ padding: 20 }} color="#1a56db" />
                ) : variants.length === 0 ? (
                  <Text style={{ textAlign: 'center', color: '#9ca3af', padding: 20 }}>
                    No variants yet. Add size, colour, or weight options.
                  </Text>
                ) : (
                  <ScrollView style={{ maxHeight: 340 }}>
                    {variants.map(v => (
                      <View key={v.id} style={styles.variantRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.variantName}>{v.name}</Text>
                          <Text style={styles.variantSub}>
                            {formatCurrency(v.price)} · Stock: {v.stock}
                            {v.sku ? ` · SKU: ${v.sku}` : ''}
                          </Text>
                        </View>
                        <TouchableOpacity onPress={() => openEditVariant(v)} style={styles.iconBtn}>
                          <Text>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteVariant(v)} style={styles.iconBtn}>
                          <Text>🗑</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>{editVariant ? 'Edit Variant' : 'New Variant'}</Text>

                {/* Attribute type tabs */}
                {!editVariant && (
                  <View style={styles.attrTabs}>
                    {[
                      { key: 'size',   label: '📏 Size'   },
                      { key: 'color',  label: '🎨 Color'  },
                      { key: 'weight', label: '⚖️ Weight' },
                      { key: 'custom', label: '✏️ Custom' },
                    ].map(t => (
                      <TouchableOpacity
                        key={t.key}
                        style={[styles.attrTab, attrTab === t.key && styles.attrTabActive]}
                        onPress={() => setAttrTab(t.key)}
                      >
                        <Text style={[styles.attrTabText, attrTab === t.key && styles.attrTabTextActive]}>
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Size presets */}
                {attrTab === 'size' && !editVariant && (
                  <View style={styles.attrSection}>
                    <Text style={styles.attrHint}>Tap sizes to build the name, then adjust price & stock below</Text>
                    {[
                      ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'],
                      ['One Size', '36', '37', '38', '39', '40', '41', '42', '43', '44'],
                      ['250ml', '500ml', '1L', '2L', '5L'],
                    ].map((row, ri) => (
                      <View key={ri} style={styles.attrChipRow}>
                        {row.map(s => (
                          <TouchableOpacity
                            key={s}
                            style={[styles.attrChip, variantForm.name === s && styles.attrChipActive]}
                            onPress={() => setVariantForm(f => ({ ...f, name: s }))}
                          >
                            <Text style={[styles.attrChipText, variantForm.name === s && styles.attrChipTextActive]}>{s}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ))}
                  </View>
                )}

                {/* Color presets */}
                {attrTab === 'color' && !editVariant && (
                  <View style={styles.attrSection}>
                    <Text style={styles.attrHint}>Tap a color to set the name, or type a custom color below</Text>
                    <View style={styles.attrChipRow}>
                      {['Black','White','Red','Blue','Green','Yellow','Pink','Orange','Purple','Gray','Brown','Navy','Beige','Gold'].map(c => (
                        <TouchableOpacity
                          key={c}
                          style={[styles.attrChip, variantForm.name === c && styles.attrChipActive]}
                          onPress={() => setVariantForm(f => ({ ...f, name: c }))}
                        >
                          <Text style={[styles.attrChipText, variantForm.name === c && styles.attrChipTextActive]}>{c}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Weight input */}
                {attrTab === 'weight' && !editVariant && (
                  <View style={styles.attrSection}>
                    <Text style={styles.attrHint}>Enter weight/volume — e.g. 500 g, 1 kg, 250 ml</Text>
                    <View style={styles.weightRow}>
                      <TextInput
                        style={[styles.input, { flex: 1, marginBottom: 0 }]}
                        placeholder="Amount (e.g. 500)"
                        keyboardType="numeric"
                        value={variantForm.name.replace(/[^\d.]/g, '')}
                        onChangeText={v => {
                          const unit = variantForm.name.replace(/[\d.\s]/g, '') || 'g';
                          setVariantForm(f => ({ ...f, name: v ? `${v} ${unit}` : '' }));
                        }}
                      />
                      <View style={styles.unitPicker}>
                        {['g','kg','ml','L','oz','lb','pcs'].map(u => {
                          const currentUnit = variantForm.name.replace(/[\d.\s]/g, '') || 'g';
                          return (
                            <TouchableOpacity
                              key={u}
                              style={[styles.unitChip, currentUnit === u && styles.unitChipActive]}
                              onPress={() => {
                                const num = variantForm.name.replace(/[^\d.]/g, '');
                                setVariantForm(f => ({ ...f, name: num ? `${num} ${u}` : `1 ${u}` }));
                              }}
                            >
                              <Text style={[styles.unitChipText, currentUnit === u && styles.unitChipTextActive]}>{u}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  </View>
                )}

                {/* Variant name (always visible) */}
                <TextInput
                  style={[styles.input, { fontWeight: '600' }]}
                  placeholder={
                    attrTab === 'size'   ? 'Variant name — e.g. "L" or "XL / Red"' :
                    attrTab === 'color'  ? 'Variant name — e.g. "Red" or "L / Red"' :
                    attrTab === 'weight' ? 'Variant name — e.g. "500 g"' :
                                          'Variant name — e.g. "Large Blue" or "1 kg"'
                  }
                  value={variantForm.name}
                  onChangeText={v => setVariantForm(f => ({ ...f, name: v }))}
                />

                {/* Append size or color chip for combining attributes */}
                {(attrTab === 'size' || attrTab === 'color') && !editVariant && variantForm.name !== '' && (
                  <View style={styles.combineRow}>
                    <Text style={styles.combineHint}>Add a color or size to combine:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {(attrTab === 'size'
                        ? ['Black','White','Red','Blue','Green','Yellow','Pink','Gray']
                        : ['XS','S','M','L','XL','XXL']
                      ).map(v => (
                        <TouchableOpacity
                          key={v}
                          style={styles.attrChipSm}
                          onPress={() => setVariantForm(f => ({
                            ...f,
                            name: f.name ? `${f.name} / ${v}` : v,
                          }))}
                        >
                          <Text style={styles.attrChipSmText}>{v}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {[
                  { key: 'sku',     label: 'SKU (optional)',        numeric: false },
                  { key: 'barcode', label: 'Barcode (optional)',    numeric: false },
                  { key: 'price',   label: 'Selling price',        numeric: true  },
                  { key: 'cost',    label: 'Cost price (optional)', numeric: true  },
                  { key: 'stock',   label: 'Stock quantity',        numeric: true  },
                ].map(f => (
                  <TextInput
                    key={f.key}
                    style={styles.input}
                    placeholder={f.label}
                    value={variantForm[f.key]}
                    onChangeText={v => setVariantForm(prev => ({ ...prev, [f.key]: v }))}
                    keyboardType={f.numeric ? 'numeric' : 'default'}
                  />
                ))}
                <View style={styles.modalActions}>
                  <TouchableOpacity onPress={() => setVariantFormVisible(false)} style={styles.cancelBtn}>
                    <Text>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSaveVariant} style={styles.saveBtn}>
                    <Text style={{ color: '#fff', fontWeight: '600' }}>Save Variant</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* CSV Import Modal */}
      <Modal visible={importVisible} transparent animationType="slide" onRequestClose={() => setImportVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Import Products (CSV)</Text>
            <Text style={styles.importHint}>
              Required columns: name{'\n'}Optional: sku, barcode, price, cost, stock, category, min_stock{'\n'}Existing SKUs will be updated.
            </Text>
            <TextInput
              style={[styles.input, { height: 160, textAlignVertical: 'top', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12 }]}
              placeholder={'name,sku,price,cost,stock\nProduct A,SKU001,1000,500,10\nProduct B,,500,,5'}
              value={importCsv}
              onChangeText={setImportCsv}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => { setImportVisible(false); setImportCsv(''); }} style={styles.cancelBtn}>
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleImport} style={styles.saveBtn} disabled={importing}>
                {importing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '600' }}>Import</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingTop: 52 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  title: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  countBadge: {
    backgroundColor: '#e0e7ff', color: '#4338ca',
    fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1.5, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
    marginBottom: 10,
  },
  search: { flex: 1, fontSize: 14, color: '#0f172a', paddingVertical: 0 },
  catScroll: { marginBottom: 10, flexGrow: 0 },
  catScrollContent: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  catChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0',
    flexShrink: 0,
  },
  catChipSpaced: { marginRight: 6 },
  catChipActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  catChipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  catChipTextActive: { color: '#2563eb' },
  catDot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 5 },
  catSuggestScroll: { marginBottom: 10, flexGrow: 0 },
  catSuggestContent: { flexDirection: 'row', alignItems: 'center' },
  catSuggestChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16,
    backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: 'transparent',
    marginRight: 6, flexShrink: 0,
  },
  catSuggestChipActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  catSuggestChipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  catSuggestChipTextActive: { color: '#2563eb' },
  toolbarRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  addBtn: {
    flex: 1, backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 11,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6,
    shadowColor: '#2563eb', shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  csvBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9,
    backgroundColor: '#fff',
  },
  csvBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  importHint: { fontSize: 12, color: '#6b7280', marginBottom: 10, lineHeight: 18 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, marginBottom: 7, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  rowAccent: { width: 4, alignSelf: 'stretch' },
  rowName: { fontSize: 14, fontWeight: '700', color: '#0f172a', paddingTop: 10, paddingLeft: 10 },
  rowMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 10, paddingBottom: 10, paddingTop: 3, flexWrap: 'wrap' },
  rowCat: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  rowSub: { fontSize: 11, color: '#94a3b8' },
  rowStock: { fontSize: 11, color: '#059669', fontWeight: '600' },
  rowStockLow: { color: '#d97706' },
  rowStockOOS: { color: '#dc2626' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 6, paddingVertical: 10 },
  marginBadge: {
    backgroundColor: '#dcfce7', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2,
  },
  marginBadgeText: { fontSize: 10, color: '#16a34a', fontWeight: '700' },
  rowPrice: { fontSize: 14, fontWeight: '800', color: '#2563eb', minWidth: 70, textAlign: 'right' },
  rowActions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: 6 },
  emptyWrap: { alignItems: 'center', marginTop: 48, gap: 8 },
  empty: { fontSize: 15, color: '#94a3b8', fontWeight: '600' },
  emptyClear: { fontSize: 13, color: '#2563eb', fontWeight: '600', marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  modalBox: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 9, marginBottom: 10, fontSize: 14,
  },
  barcodeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  barcodeInput: { flex: 1, marginBottom: 0 },
  scanBtn: {
    backgroundColor: '#1a2e4a', borderRadius: 8,
    paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center',
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 4 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  saveBtn: { backgroundColor: '#1a56db', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20 },
  marginBadge: {
    fontSize: 10, color: '#16a34a', fontWeight: '700',
    backgroundColor: '#dcfce7', paddingHorizontal: 4, paddingVertical: 2,
    borderRadius: 4, marginRight: 6,
  },
  variantsBtn: { marginRight: 2 },
  addVariantBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#7c3aed', borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14, alignSelf: 'flex-start', marginBottom: 14 },
  addVariantBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  variantRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  variantName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  variantSub: { fontSize: 11, color: '#6b7280', marginTop: 2 },

  // Attribute builder
  attrTabs: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  attrTab: {
    flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center',
    backgroundColor: '#f3f4f6', borderWidth: 1.5, borderColor: 'transparent',
  },
  attrTabActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  attrTabText: { fontSize: 11, fontWeight: '600', color: '#6b7280' },
  attrTabTextActive: { color: '#2563eb' },

  attrSection: { marginBottom: 10 },
  attrHint: { fontSize: 11, color: '#9ca3af', marginBottom: 8 },
  attrChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  attrChip: {
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#f3f4f6', borderWidth: 1.5, borderColor: 'transparent',
  },
  attrChipActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  attrChipText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  attrChipTextActive: { color: '#2563eb' },

  combineRow: { marginBottom: 8 },
  combineHint: { fontSize: 11, color: '#9ca3af', marginBottom: 6 },
  attrChipSm: {
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 16,
    backgroundColor: '#fdf2f8', borderWidth: 1.5, borderColor: '#f9a8d4',
    marginRight: 6,
  },
  attrChipSmText: { fontSize: 11, fontWeight: '700', color: '#db2777' },

  weightRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 6 },
  unitPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, flex: 1 },
  unitChip: {
    paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8,
    backgroundColor: '#f3f4f6', borderWidth: 1.5, borderColor: 'transparent',
  },
  unitChipActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  unitChipText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  unitChipTextActive: { color: '#2563eb' },

  modalCard: { backgroundColor: '#fff', borderRadius: 14, padding: 20, margin: 0 },
});
