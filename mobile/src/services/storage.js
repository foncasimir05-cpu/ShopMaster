/**
 * Thin wrapper around AsyncStorage (React Native) or localStorage (web) for
 * persisting auth tokens and small configuration values locally.
 *
 * We detect the platform at runtime so the same module works in Expo on both
 * Android and web without requiring conditional imports.
 */

import { Platform } from 'react-native';

async function getItem(key) {
  if (Platform.OS === 'web') {
    return Promise.resolve(localStorage.getItem(key));
  }
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  return AsyncStorage.getItem(key);
}

async function setItem(key, value) {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return Promise.resolve();
  }
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  return AsyncStorage.setItem(key, value);
}

async function removeItem(key) {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return Promise.resolve();
  }
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  return AsyncStorage.removeItem(key);
}

export { getItem, setItem, removeItem };
