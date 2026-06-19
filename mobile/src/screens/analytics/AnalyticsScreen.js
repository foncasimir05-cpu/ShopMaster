import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useShop } from '../../context/ShopContext';
import * as api from '../../services/api';
import { F } from '../../theme';
import { cacheAnalytics, getCachedAnalytics } from '../../services/offlineQueue';
import { isNetworkErr } from '../../utils/netError';

const METHOD_COLORS = {
  cash: '#16a34a',
  card: '#1a56db',
  mobile_money: '#d97706',
};

export default function AnalyticsScreen() {
  const { t } = useTranslation();
  const { formatCurrency } = useShop();
  const PERIODS = [
    { label: t('analytics.periods.days7'), days: 7 },
    { label: t('analytics.periods.days30'), days: 30 },
    { label: t('analytics.periods.days90'), days: 90 },
  ];
  const [period, setPeriod] = useState(PERIODS[0]);
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  const load = useCallback(async (days) => {
    try {
      const [s, tr, top, pay] = await Promise.all([
        api.getAnalyticsSummary(),
        api.getAnalyticsTrend(days),
        api.getTopProducts(days),
        api.getPaymentBreakdown(days),
      ]);
      setSummary(s);
      setTrend(tr);
      setTopProducts(top);
      setPaymentBreakdown(pay);
      setFromCache(false);
      cacheAnalytics({ summary: s, trend: tr, topProducts: top, paymentBreakdown: pay });
    } catch (e) {
      if (isNetworkErr(e)) {
        const cached = await getCachedAnalytics();
        if (cached) {
          setSummary(cached.summary);
          setTrend(cached.trend ?? []);
          setTopProducts(cached.topProducts ?? []);
          setPaymentBreakdown(cached.paymentBreakdown ?? []);
          setFromCache(true);
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { setLoading(true); load(period.days); }, [period, load]);

  const onRefresh = () => { setRefreshing(true); load(period.days); };

  const totalPaymentRevenue = paymentBreakdown.reduce((s, r) => s + r.revenue, 0);
  const netProfit = summary?.month?.net_profit ?? 0;

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1a56db" /></View>;
  }

  if (!summary) {
    return <View style={styles.center}><Text style={{ color: '#9ca3af', fontSize: 14 }}>No data available offline.</Text></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.heading}>{t('analytics.title')}</Text>
      {fromCache && (
        <View style={{ backgroundColor: '#fef3c7', borderRadius: 8, padding: 8, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 12, color: '#92400e' }}>⚡ Offline — showing cached data. Pull down to refresh when connected.</Text>
        </View>
      )}

      {/* ─── Today ─────────────────────────────────── */}
      <SectionHead label="TODAY" color="#1a56db" />
      <View style={styles.kpiRow}>
        <KpiCard
          icon="trending-up-outline"
          iconColor="#1a56db"
          label={t('analytics.revenue')}
          value={formatCurrency(summary?.today?.revenue ?? 0)}
          sub={`${summary?.today?.sales_count ?? 0} ${t('analytics.transactions')}`}
        />
        <KpiCard
          icon="cash-outline"
          iconColor="#16a34a"
          label={t('analytics.profit')}
          value={formatCurrency(summary?.today?.profit ?? 0)}
          sub={t('analytics.grossProfit')}
        />
      </View>

      {/* ─── This Week ─────────────────────────────── */}
      <SectionHead label="THIS WEEK" color="#7c3aed" />
      <View style={styles.kpiRow}>
        <KpiCard
          icon="bar-chart-outline"
          iconColor="#7c3aed"
          label={t('analytics.revenue')}
          value={formatCurrency(summary?.week?.revenue ?? 0)}
          sub={`${summary?.week?.sales_count ?? 0} ${t('analytics.transactions')}`}
        />
        <KpiCard
          icon="stats-chart-outline"
          iconColor="#059669"
          label={t('analytics.profit')}
          value={formatCurrency(summary?.week?.profit ?? 0)}
          sub={t('analytics.grossProfit')}
        />
      </View>

      {/* ─── This Month ────────────────────────────── */}
      <SectionHead label="THIS MONTH" color="#0891b2" />
      <View style={styles.kpiRow}>
        <KpiCard
          icon="calendar-outline"
          iconColor="#0891b2"
          label={t('analytics.revenue')}
          value={formatCurrency(summary?.month?.revenue ?? 0)}
          sub={`${summary?.month?.sales_count ?? 0} ${t('analytics.transactions')}`}
        />
        <KpiCard
          icon="wallet-outline"
          iconColor={netProfit >= 0 ? '#059669' : '#dc2626'}
          label={t('analytics.netProfit')}
          value={formatCurrency(netProfit)}
          sub={t('analytics.afterExpenses')}
        />
      </View>
      <View style={styles.kpiRow}>
        <KpiCard
          icon="card-outline"
          iconColor="#dc2626"
          label={t('analytics.expenses')}
          value={formatCurrency(summary?.month?.expenses ?? 0)}
          sub={t('analytics.totalExpensesLabel')}
        />
        <KpiCard
          icon="receipt-outline"
          iconColor="#d97706"
          label={t('analytics.avgSale')}
          value={formatCurrency(summary?.avgOrder30d ?? 0)}
          sub={t('analytics.last30Days')}
        />
      </View>

      {/* Revenue + Profit Trend Chart */}
      <View style={[styles.card, { marginTop: 10 }]}>
        <View style={styles.chartTitleRow}>
          <Text style={styles.cardTitle}>{t('analytics.salesTrend')}</Text>
          <View style={styles.chartLegend}>
            <View style={styles.legendDot} />
            <Text style={styles.legendText}>{t('analytics.revenue')}</Text>
            <View style={[styles.legendDot, { backgroundColor: '#86efac' }]} />
            <Text style={styles.legendText}>{t('analytics.legendProfit')}</Text>
          </View>
        </View>
        <View style={styles.periodRow} accessibilityRole="radiogroup">
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p.days}
              style={[styles.periodPill, period.days === p.days && styles.periodPillActive]}
              onPress={() => setPeriod(p)}
              accessibilityRole="radio"
              accessibilityState={{ selected: period.days === p.days }}
              accessibilityLabel={p.label}
            >
              <Text style={[styles.periodText, period.days === p.days && styles.periodTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <DualBarChart data={trend} />
      </View>

      {/* Top Products */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('analytics.topProducts')}</Text>
        {topProducts.length === 0
          ? <Text style={styles.empty}>{t('analytics.noTopProducts')}</Text>
          : topProducts.map((p, i) => (
            <TopProductRow key={p.id} rank={i + 1} product={p} maxRevenue={topProducts[0].revenue} />
          ))
        }
      </View>

      {/* Payment Breakdown */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('analytics.paymentMethods')}</Text>
        {paymentBreakdown.length === 0
          ? <Text style={styles.empty}>{t('analytics.noData')}</Text>
          : paymentBreakdown.map(row => (
            <PaymentBar
              key={row.payment_method}
              method={row.payment_method}
              revenue={row.revenue}
              count={row.sales_count}
              total={totalPaymentRevenue}
            />
          ))
        }
      </View>

      {/* All-time summary */}
      <View style={[styles.card, { marginBottom: 32 }]}>
        <Text style={styles.cardTitle}>{t('analytics.allTime')}</Text>
        <View style={styles.allTimeRow}>
          <Text style={styles.allTimeLabel}>{t('analytics.totalSales')}</Text>
          <Text style={styles.allTimeValue}>{summary?.allTime?.sales_count ?? 0}</Text>
        </View>
        <View style={styles.allTimeRow}>
          <Text style={styles.allTimeLabel}>{t('analytics.totalRevenue')}</Text>
          <Text style={[styles.allTimeValue, { color: '#1a56db' }]}>
            {formatCurrency(summary?.allTime?.revenue ?? 0)}
          </Text>
        </View>
        <View style={styles.allTimeRow}>
          <Text style={styles.allTimeLabel}>{t('analytics.totalProfit')}</Text>
          <Text style={[styles.allTimeValue, { color: '#16a34a' }]}>
            {formatCurrency(summary?.allTime?.profit ?? 0)}
          </Text>
        </View>
        {(summary?.allTime?.expenses ?? 0) > 0 && (
          <>
            <View style={styles.allTimeRow}>
              <Text style={styles.allTimeLabel}>{t('analytics.totalExpenses')}</Text>
              <Text style={[styles.allTimeValue, { color: '#dc2626' }]}>
                -{formatCurrency(summary.allTime.expenses)}
              </Text>
            </View>
            <View style={styles.allTimeRow}>
              <Text style={[styles.allTimeLabel, { fontFamily: F.bold }]}>{t('analytics.netProfit')}</Text>
              <Text style={[
                styles.allTimeValue,
                { fontFamily: F.black, color: summary.allTime.net_profit >= 0 ? '#059669' : '#dc2626' },
              ]}>
                {formatCurrency(summary.allTime.net_profit)}
              </Text>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

function SectionHead({ label, color }) {
  return (
    <View style={styles.sectionHead}>
      <View style={[styles.sectionAccent, { backgroundColor: color }]} />
      <Text style={[styles.sectionHeadLabel, { color }]}>{label}</Text>
      <View style={[styles.sectionLine, { backgroundColor: color + '22' }]} />
    </View>
  );
}

function KpiCard({ icon, iconColor, label, value, sub }) {
  return (
    <View style={styles.kpiCard}>
      <View style={[styles.kpiIconWrap, { backgroundColor: iconColor + '18' }]}>
        <Ionicons name={icon} size={17} color={iconColor} />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiSub}>{sub}</Text>
    </View>
  );
}

function DualBarChart({ data }) {
  const { t } = useTranslation();
  if (!data || data.length === 0) return <Text style={styles.empty}>{t('analytics.chartNoData')}</Text>;

  const maxVal = Math.max(...data.map(d => d.revenue), 1);
  const MAX_H = 90;
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <View>
      <View style={styles.chartArea}>
        {data.map(d => {
          const revH = Math.max((d.revenue / maxVal) * MAX_H, d.revenue > 0 ? 3 : 1);
          const profH = d.profit > 0 ? Math.max((d.profit / maxVal) * MAX_H, 2) : 0;
          const isToday = d.date === todayStr;
          const dateObj = new Date(d.date + 'T00:00:00');
          const label = data.length <= 7
            ? dateObj.toLocaleDateString('en', { weekday: 'short' }).slice(0, 3)
            : dateObj.getDate().toString();

          return (
            <View key={d.date} style={styles.barCol}>
              {d.revenue > 0 && (
                <Text style={styles.barValue}>{abbrevNum(d.revenue)}</Text>
              )}
              <View style={styles.dualBarGroup}>
                <View style={[styles.bar, { height: revH, backgroundColor: isToday ? '#1a56db' : '#bfdbfe', flex: 1 }]} />
                <View style={[styles.bar, { height: profH, backgroundColor: isToday ? '#16a34a' : '#86efac', flex: 1 }]} />
              </View>
              <Text style={[styles.barLabel, isToday && { color: '#1a56db', fontFamily: F.bold }]}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function TopProductRow({ rank, product, maxRevenue }) {
  const { t } = useTranslation();
  const { formatCurrency } = useShop();
  const pct = maxRevenue > 0 ? (product.revenue / maxRevenue) : 0;
  return (
    <View style={styles.topRow}>
      <Text style={styles.topRank}>{rank}</Text>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
          <Text style={styles.topName} numberOfLines={1}>{product.name}</Text>
          <Text style={styles.topRevenue}>{formatCurrency(product.revenue)}</Text>
        </View>
        <View style={styles.topBarBg}>
          <View style={[styles.topBar, { width: `${pct * 100}%` }]} />
        </View>
        <Text style={styles.topUnits}>
          {t('analytics.unitsSold', { count: product.units_sold })}
          {product.margin_pct !== undefined ? ` · ${t('analytics.marginPct', { pct: product.margin_pct })}` : ''}
        </Text>
      </View>
    </View>
  );
}

function PaymentBar({ method, revenue, count, total }) {
  const { t } = useTranslation();
  const { formatCurrency } = useShop();
  const pct = total > 0 ? revenue / total : 0;
  const color = METHOD_COLORS[method] ?? '#6b7280';
  const label = method === 'cash' ? t('analytics.cash') : method === 'card' ? t('analytics.card') : t('analytics.mobileMoney');
  return (
    <View style={styles.payRow}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={[styles.payDot, { backgroundColor: color }]} />
          <Text style={styles.payLabel}>{label}</Text>
        </View>
        <Text style={styles.payValue}>
          {formatCurrency(revenue)}
          <Text style={styles.payCount}>  {t('analytics.salesCount', { count })}</Text>
        </Text>
      </View>
      <View style={styles.payBarBg}>
        <View style={[styles.payBar, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function abbrevNum(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(Math.round(n));
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingTop: 56 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 26, fontFamily: F.black, color: '#111827', marginBottom: 20 },

  // Section headers
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 10, marginTop: 4,
  },
  sectionAccent: { width: 3, height: 14, borderRadius: 2 },
  sectionHeadLabel: { fontSize: 10, fontFamily: F.black, letterSpacing: 1.5 },
  sectionLine: { flex: 1, height: 1 },

  // KPI cards
  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  kpiCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16,
    padding: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  kpiIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  kpiValue: { fontSize: 19, fontFamily: F.black, color: '#0f172a', marginBottom: 2 },
  kpiLabel: { fontSize: 11, fontFamily: F.medium, color: '#6b7280' },
  kpiSub: { fontSize: 10, color: '#9ca3af', marginTop: 2 },

  // Period selector
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  periodPill: {
    flex: 1, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#d1d5db', alignItems: 'center',
  },
  periodPillActive: { borderColor: '#1a56db', backgroundColor: '#eff6ff' },
  periodText: { fontSize: 13, color: '#6b7280', fontFamily: F.semiBold },
  periodTextActive: { color: '#1a56db' },

  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  cardTitle: { fontSize: 15, fontFamily: F.extraBold, color: '#111827', marginBottom: 14 },
  empty: { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingVertical: 12 },

  chartTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  chartLegend: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#bfdbfe' },
  legendText: { fontSize: 10, color: '#9ca3af', fontFamily: F.semiBold },

  chartArea: {
    flexDirection: 'row', alignItems: 'flex-end',
    height: 130, paddingTop: 16,
  },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barValue: { fontSize: 8, color: '#6b7280', marginBottom: 2 },
  dualBarGroup: { flexDirection: 'row', alignItems: 'flex-end', width: '80%', gap: 1 },
  bar: { borderRadius: 3 },
  barLabel: { fontSize: 9, color: '#9ca3af', marginTop: 4 },

  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  topRank: { fontSize: 16, fontFamily: F.black, color: '#d1d5db', width: 20, textAlign: 'center', marginTop: 1 },
  topName: { fontSize: 13, fontFamily: F.bold, color: '#111827', flex: 1, marginRight: 8 },
  topRevenue: { fontSize: 13, fontFamily: F.bold, color: '#1a56db' },
  topBarBg: { height: 5, backgroundColor: '#f3f4f6', borderRadius: 3 },
  topBar: { height: 5, backgroundColor: '#1a56db', borderRadius: 3 },
  topUnits: { fontSize: 10, color: '#9ca3af', marginTop: 2 },

  payRow: { marginBottom: 14 },
  payDot: { width: 8, height: 8, borderRadius: 4 },
  payLabel: { fontSize: 13, color: '#374151', fontFamily: F.semiBold },
  payValue: { fontSize: 13, fontFamily: F.bold, color: '#111827' },
  payCount: { fontSize: 11, color: '#9ca3af', fontFamily: F.regular },
  payBarBg: { height: 8, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden' },
  payBar: { height: 8, borderRadius: 4 },

  allTimeRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  allTimeLabel: { fontSize: 14, color: '#6b7280' },
  allTimeValue: { fontSize: 14, fontFamily: F.extraBold, color: '#111827' },
});
