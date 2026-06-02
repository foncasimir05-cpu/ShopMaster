import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View } from 'react-native';
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
    </SettingsStack.Navigator>
  );
}

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
        <RootNavigator />
        <StatusBar style="auto" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
