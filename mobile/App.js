import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterShopScreen from './src/screens/auth/RegisterShopScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProductsScreen from './src/screens/ProductsScreen';
import InventoryScreen from './src/screens/InventoryScreen';
import POSScreen from './src/screens/pos/POSScreen';
import SalesHistoryScreen from './src/screens/sales/SalesHistoryScreen';
import SettingsScreen from './src/screens/settings/SettingsScreen';
import UserManagementScreen from './src/screens/settings/UserManagementScreen';
import SubShopsScreen from './src/screens/settings/SubShopsScreen';
import ForgotScreen from './src/screens/auth/ForgotScreen';

const Stack = createNativeStackNavigator();
const SettingsStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Home:         { focused: 'home',     blur: 'home-outline' },
  Products:     { focused: 'cube',     blur: 'cube-outline' },
  POS:          { focused: 'cart',     blur: 'cart-outline' },
  SalesHistory: { focused: 'receipt',  blur: 'receipt-outline' },
  Inventory:    { focused: 'layers',   blur: 'layers-outline' },
  SettingsTab:  { focused: 'settings', blur: 'settings-outline' },
};

function SettingsNavigator() {
  return (
    <SettingsStack.Navigator screenOptions={{ headerShown: false }}>
      <SettingsStack.Screen name="Settings" component={SettingsScreen} />
      <SettingsStack.Screen name="UserManagement" component={UserManagementScreen} />
      <SettingsStack.Screen name="SubShops" component={SubShopsScreen} />
    </SettingsStack.Navigator>
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
  const role = user?.role;
  const isCashier = role === 'cashier';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#1a2e4a',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarIcon: ({ focused, color, size }) => {
          const icon = TAB_ICONS[route.name];
          return <Ionicons name={focused ? icon.focused : icon.blur} size={size} color={color} />;
        },
      })}
    >
      {isCashier ? (
        <Tab.Screen name="POS" component={POSScreen} />
      ) : (
        <>
          <Tab.Screen name="Home" component={HomeScreen} />
          <Tab.Screen name="Products" component={ProductsScreen} />
          <Tab.Screen name="POS" component={POSScreen} />
          <Tab.Screen name="SalesHistory" component={SalesHistoryScreen} options={{ title: 'Sales' }} />
          <Tab.Screen name="Inventory" component={InventoryScreen} />
          <Tab.Screen name="SettingsTab" component={SettingsNavigator} options={{ title: 'Settings' }} />
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
    <SafeAreaProvider>
      <AuthProvider>
        <SubShopBanner />
        <RootNavigator />
        <StatusBar style="auto" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
