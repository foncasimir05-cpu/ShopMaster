import './src/i18n'; // must be first — initialises i18next before any screen renders
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import ErrorBoundary from './src/components/ErrorBoundary';
import { registerPushToken } from './src/services/api';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ShopProvider } from './src/context/ShopContext';
import { StockAlertProvider, useStockAlert } from './src/context/StockAlertContext';
import { OfflineProvider, useOffline } from './src/context/OfflineContext';
import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterShopScreen from './src/screens/auth/RegisterShopScreen';
import ForgotScreen from './src/screens/auth/ForgotScreen';
import HomeScreen from './src/screens/HomeScreen';
import CloseOfDayScreen from './src/screens/CloseOfDayScreen';
import AnalyticsScreen from './src/screens/analytics/AnalyticsScreen';
import ProductsScreen from './src/screens/ProductsScreen';
import InventoryScreen from './src/screens/InventoryScreen';
import POSScreen from './src/screens/pos/POSScreen';
import SalesHistoryScreen from './src/screens/sales/SalesHistoryScreen';
import CustomersScreen from './src/screens/customers/CustomersScreen';
import SettingsScreen from './src/screens/settings/SettingsScreen';
import UserManagementScreen from './src/screens/settings/UserManagementScreen';
import SubShopsScreen from './src/screens/settings/SubShopsScreen';
import PremiumScreen from './src/screens/settings/PremiumScreen';
import SuppliersScreen from './src/screens/suppliers/SuppliersScreen';
import PurchaseOrdersScreen from './src/screens/suppliers/PurchaseOrdersScreen';
import PromotionsScreen from './src/screens/promotions/PromotionsScreen';
import ExpensesScreen from './src/screens/expenses/ExpensesScreen';

const Stack = createNativeStackNavigator();
const HomeStack = createNativeStackNavigator();
const SettingsStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Home:         { focused: 'home',            blur: 'home-outline' },
  Products:     { focused: 'cube',            blur: 'cube-outline' },
  POS:          { focused: 'cart',            blur: 'cart-outline' },
  SalesHistory: { focused: 'receipt',         blur: 'receipt-outline' },
  Customers:    { focused: 'people',          blur: 'people-outline' },
  Inventory:    { focused: 'layers',          blur: 'layers-outline' },
  SettingsTab:  { focused: 'settings',        blur: 'settings-outline' },
};

function HomeNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeScreen" component={HomeScreen} />
      <HomeStack.Screen name="CloseOfDay" component={CloseOfDayScreen} />
      <HomeStack.Screen name="Analytics" component={AnalyticsScreen} />
      <HomeStack.Screen name="Suppliers" component={SuppliersScreen} />
      <HomeStack.Screen name="PurchaseOrders" component={PurchaseOrdersScreen} />
      <HomeStack.Screen name="Promotions" component={PromotionsScreen} />
      <HomeStack.Screen name="Expenses" component={ExpensesScreen} />
    </HomeStack.Navigator>
  );
}

function SettingsNavigator() {
  return (
    <SettingsStack.Navigator screenOptions={{ headerShown: false }}>
      <SettingsStack.Screen name="Settings" component={SettingsScreen} />
      <SettingsStack.Screen name="UserManagement" component={UserManagementScreen} />
      <SettingsStack.Screen name="SubShops" component={SubShopsScreen} />
      <SettingsStack.Screen name="Premium" component={PremiumScreen} />
    </SettingsStack.Navigator>
  );
}

// Registers for Expo push notifications and sends the token to the server.
// Runs once after the user is authenticated. Silent on simulator or permission denial.
function PushRegistration() {
  const { accessToken } = useAuth();
  useEffect(() => {
    if (!accessToken || Platform.OS === 'web') return;
    (async () => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        const finalStatus = status !== 'granted'
          ? (await Notifications.requestPermissionsAsync()).status
          : status;
        if (finalStatus !== 'granted') return;

        const projectId = 'bdbc962f-b11c-4ba7-92f3-d14ae53cc895';
        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
        if (token) await registerPushToken(token);
      } catch {}
    })();
  }, [accessToken]);
  return null;
}

function OfflineBanner() {
  const { isOnline, pendingCount } = useOffline();
  if (isOnline) return null;
  return (
    <View style={[bannerStyles.bar, { backgroundColor: '#dc2626' }]}>
      <Ionicons name="cloud-offline-outline" size={14} color="#fff" />
      <Text style={bannerStyles.text}>
        Offline{pendingCount > 0 ? ` · ${pendingCount} sale${pendingCount !== 1 ? 's' : ''} queued` : ''}
      </Text>
    </View>
  );
}

function SubShopBanner() {
  const { isViewingSubShop, user, switchBackToParent, parentUser } = useAuth();
  if (!isViewingSubShop) return null;
  return (
    <View style={bannerStyles.bar}>
      <Ionicons name="storefront-outline" size={14} color="#fff" />
      <Text style={bannerStyles.text} numberOfLines={1}>
        Viewing: <Text style={bannerStyles.bold}>{user?.shopName}</Text>
      </Text>
      <TouchableOpacity onPress={switchBackToParent} style={bannerStyles.btn}>
        <Text style={bannerStyles.btnText}>← Back to {parentUser?.shopName ?? 'Main Shop'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  bar: { backgroundColor: '#1a2e4a', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexWrap: 'wrap' },
  text: { flex: 1, color: '#e5e7eb', fontSize: 12 },
  bold: { color: '#fff', fontWeight: '700' },
  btn: { backgroundColor: '#d97706', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  btnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});

function MainTabs() {
  const { user } = useAuth();
  const { count: lowStockCount } = useStockAlert();
  const { t } = useTranslation();
  const role = user?.role;
  const isCashier = role === 'cashier';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#e2e8f0',
          borderTopWidth: 1,
          paddingTop: 4,
          height: 60,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 10,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginBottom: 4 },
        tabBarIcon: ({ focused, color, size }) => {
          const icon = TAB_ICONS[route.name];
          return <Ionicons name={focused ? icon.focused : icon.blur} size={focused ? size + 1 : size} color={color} />;
        },
      })}
    >
      {isCashier ? (
        <Tab.Screen name="POS" component={POSScreen} />
      ) : (
        <>
          <Tab.Screen name="Home" component={HomeNavigator} options={{ title: t('nav.home') }} />
          <Tab.Screen
            name="Products"
            component={ProductsScreen}
            options={{ title: t('nav.products'), tabBarBadge: lowStockCount > 0 ? lowStockCount : undefined }}
          />
          <Tab.Screen name="POS" component={POSScreen} options={{ title: t('nav.pos') }} />
          <Tab.Screen name="SalesHistory" component={SalesHistoryScreen} options={{ title: t('nav.sales') }} />
          <Tab.Screen name="Customers" component={CustomersScreen} options={{ title: t('nav.customers') }} />
          <Tab.Screen name="Inventory" component={InventoryScreen} options={{ title: t('nav.inventory') }} />
          <Tab.Screen name="SettingsTab" component={SettingsNavigator} options={{ title: t('nav.settings') }} />
        </>
      )}
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { accessToken, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1a2e4a" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {accessToken ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="RegisterShop" component={RegisterShopScreen} />
            <Stack.Screen name="Forgot" component={ForgotScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <ShopProvider>
            <StockAlertProvider>
              <OfflineProvider>
                <PushRegistration />
                <SubShopBanner />
                <OfflineBanner />
                <RootNavigator />
                <StatusBar style="auto" />
              </OfflineProvider>
            </StockAlertProvider>
          </ShopProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
